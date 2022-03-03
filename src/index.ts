import { readFileSync } from "fs";
import { glob } from "glob";
import * as _ from "lodash";
import { trimStart } from "lodash";
import { chdir } from "process";
import * as ts from "typescript";

export function delint(sourceFile: ts.SourceFile) {
  delintNode(sourceFile);

  function delintNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.JsxSelfClosingElement:
      case ts.SyntaxKind.JsxOpeningElement:
        report(node);
        break;
    }

    ts.forEachChild(node, delintNode);
  }

  function createNameStack(tagName: string, node: ts.Node) {
    const namesStack = [tagName];
    for (let top: ts.Node = node; top; top = top.parent) {
      if (
        ts.SyntaxKind.VariableDeclaration === top.kind &&
        ts.isVariableDeclaration(top)
      ) {
        namesStack.push(top.name.getText());
      }
      if (
        ts.SyntaxKind.FunctionDeclaration === top.kind &&
        ts.isFunctionDeclaration(top)
      ) {
        namesStack.push(top.name!.getText());
      }
    }
    return namesStack;
  }
  function write(str: string, node: ts.Node) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart()
    );
    console.log(
      `${sourceFile.fileName} (${line + 1},${character + 1}): ${str}`
    );
  }
  function report(node: ts.Node) {
    if (!(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
      return;
    }

    const tagName = node.tagName.getText();
    if (tagName == "TextInput") {
      const values = node.attributes.properties.filter(
        (e) =>
          e.name?.getText() === "defaultValue" || e.name?.getText() === "value"
      );

      const fillers = values.map((e) => {
        if (ts.isJsxAttribute(e)) {
          return e.initializer
            ?.getText()
            .replace(/\[|\./gm, "-")
            .replace("]", "")
            .replace(/{|}/gm, "");
        }
      });
      const pair = _.zip(
        values.map((e) => e.name!.getText()),
        fillers
      );

      let str = createNameStack(tagName, node).reverse().join("/");
      const t = pair.map((e) => `${e[0]}=${e[1]}`).join("__");
      if (t) {
        str += "|";
        str += t;
      }
      str += "--" + Math.floor(Math.random() * 2 ** 32).toString(16);
      write(str, node);
    }

    if (tagName === "TouchableOpacity") {
      const n = node.parent;
      if (ts.isJsxElement(n)) {
        const res = walkRecursive(n);
        let str = createNameStack(tagName, node).reverse().join("/");
        if (res.length == 1) {
          str += "|";
          str += res[0].replace(/{|}/gm, "");
        }

        const x = res.filter((e) => e === "{e-symbol}");
        if (x.length >= 2) {
          str += "|";
          str += "PressableAsset";
        }
        str += "--" + Math.floor(Math.random() * 2 ** 32).toString(16);
        write(str, node);
      }
    }
  }
}

function walkRecursive(node: ts.JsxElement) {
  const extract = (child: ts.Node): any => {
    switch (child.kind) {
      case ts.SyntaxKind.JsxElement:
        if (ts.isJsxElement(child)) {
          return walkRecursive(child);
        }
      case ts.SyntaxKind.JsxText:
        return child.getText();

      case ts.SyntaxKind.JsxExpression:
        return child.getText();
      case ts.SyntaxKind.JsxSelfClosingElement:
        if (ts.isJsxSelfClosingElement(child)) {
          const atrs = child.attributes.properties.map((e) =>
            e.name?.getText()
          );
          if (atrs.includes("width") || atrs.includes("height")) {
            return child.tagName.getText();
          }
          if (atrs.includes("source")) {
            if (child.getText().indexOf("_asset.icon") !== -1) {
              return "AssetIcon";
            }
          }
        }
      default:
        return null;
    }
  };
  const ret = node.children.map((e) => extract(e));
  return _.flattenDeep(ret)
    .filter((e) => e)
    .map((e) => e.trim().replace(".", "-").replace(" ", "_"));
}

function main() {
  const [root] = process.argv.slice(2);
  process.chdir(root);
  const files = glob.sync(`**/*.tsx`);
  files.forEach((fileName) => {
    // Parse a file
    const sourceFile = ts.createSourceFile(
      fileName,
      readFileSync(fileName).toString(),
      ts.ScriptTarget.ES2015,
      /*setParentNodes */ true
    );

    // delint it
    delint(sourceFile);
  });
}

main();
