import _isEqual from 'lodash/isEqual';
import _forEach from 'lodash/forEach';

import { getNestedPathObject } from "./utils.js";

function transformer(file, api) {
  const j = api.jscodeshift,
    stats = api.stats,
    root = j(file.source);

  let isClassnameInvocation = path => {
    return (
      j.CallExpression.check(path.node) &&
      path.node.callee.name === "classnames"
    );
  };

  let getClosestParent = (path, filter) => {
    let parent = path.parent;
    while (parent && (filter && !filter(parent))) {
      parent = parent.parent;
    }
    return parent;
  };

  let getClassnameCallExpression = (args) => {
    return j.callExpression(j.identifier('classnames'), [j.objectExpression(
      args.map(({value, key}) => {
      return j.objectProperty(key, value)
    })
    )]);
  }

  let transformVariables = varPath => {
    var varScope = varPath.scope,
      varName = varPath.value.name,
      classnameBuilderArgs = [],
      varDeclaratorPath = null;

    while (varScope && !varScope.declares(varName)) {
      varScope = varScope.parent;
    }

    if (!varScope) {
      console.log(`${varName} is not declared !!`);
      return;
    }

    let collateClassnameBuilderArgs = (path, condition = j.booleanLiteral(true)) => {
      if (j.Literal.check(path.node)) {
        classnameBuilderArgs.push({key: path.node, value: condition});
      } else if(j.Identifier.check(path.node) && path.node.name === varName) {
        return;//do ntn
      } else if (j.BinaryExpression.check(path.node)) {
        //do it for left and right
      } //handle ternary here
    };

    let collateCondition = (stmtPath, logicalExpressionAcc=[]) => {
      //convert to LogicalExpression
      let convertToAndLogicalExpression = (logicalExpArgs) => {
        if(!logicalExpArgs || !logicalExpArgs.length) {
          return;
        } else if(logicalExpArgs.length === 1) {
          return logicalExpArgs[0];
        }
        return j.logicalExpression("&&", logicalExpArgs[0], convertToAndLogicalExpression(logicalExpArgs.slice(1)) )
      };

      let closestIfBodyPath = getClosestParent(stmtPath, (path) => {
        return j.IfStatement.check(path.parentPath && path.parentPath.node)
      });
      if(!closestIfBodyPath) {
        return convertToAndLogicalExpression(logicalExpressionAcc);
      }
      let closestIfConditionPath = closestIfBodyPath.parentPath;
      let varBinding = varScope.getBindings()[varName];
      let isConsequent = true;

      if (
        !closestIfConditionPath ||
        !varBinding ||
        closestIfConditionPath.value.start < varBinding[0].value.start
      ) {
        return convertToAndLogicalExpression(logicalExpressionAcc);
      }

      if(_isEqual(closestIfBodyPath,closestIfConditionPath.get('alternate'))) {
        isConsequent = false;
      }

      if(isConsequent) {
        logicalExpressionAcc.push(closestIfConditionPath.value.test);
      } else {
        logicalExpressionAcc.push(j.unaryExpression("!",closestIfConditionPath.value.test))
      }

      return collateCondition(closestIfBodyPath, logicalExpressionAcc);
    };

    j(varScope.path)
      .find(j.Identifier, { name: varName })
      .forEach(path => {
        let parentPath = path.parentPath,
          parentNode = parentPath.node;
        if (
          j.JSXExpressionContainer.check(parentNode) ||
          j.JSXAttribute.check(parentNode)
        ) {
          return;
        }
        if (j.VariableDeclarator.check(parentNode)) {
          varDeclaratorPath = parentPath;
          if (parentNode.init) {
            //if an initial value is defined
            if (isClassnameInvocation(parentPath.get("init"))) {
              return;
            }
            collateClassnameBuilderArgs(parentPath.get("init"));
          }
        } else if (
          j.AssignmentExpression.check(parentNode) &&
          j.Identifier.check(parentNode.left) &&
          parentNode.left.name === varName
        ) {
          if (isClassnameInvocation(parentPath.get("right"))) {
            return;
          }
          if (parentNode.operator === "+=" || parentNode.operator === "=") {
            collateClassnameBuilderArgs(
              parentPath.get("right"),
              collateCondition(parentPath)
            );
          }
        } else {
          //Variable neither assigned nor declared
        }
      });
    
    let callExpression = getClassnameCallExpression(classnameBuilderArgs);
    varDeclaratorPath.value.init = callExpression;
  };

  return root
    .find(j.JSXAttribute, { name: { name: "className" } })
    .forEach(path => {
      var { node } = path;
      if (j.JSXExpressionContainer.check(node.value)) {
        let expressionPath = getNestedPathObject(path, ["value", "expression"]);
        if (j.Identifier.check(expressionPath.value)) {
          //variable
          transformVariables(expressionPath);
        } else if (j.CallExpression.check(expressionPath.value)) {
          // //classnames
          // //assertClassnameInvocation(expressionPath)
          // stats('classname_jsx_func')
          // if(!isClassnameInvocation(expressionPath)) {
          //         stats('ERR classname_jsx_func_not_classname')
          // }
        } else if (j.MemberExpression.check(expressionPath.value)) {
          //object prop
        } else {
        }
      } else if (j.Literal.check(node.value)) {
        //todo
      } else {
        //todo
      }
    })
    .toSource();
}

module.exports = transformer;
