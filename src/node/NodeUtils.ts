import * as escodegen from 'escodegen';
import * as espree from 'espree';
import * as estraverse from 'estraverse';
import * as ESTree from 'estree';

import { TObject } from '../types/TObject';

import { NodeGuards } from './NodeGuards';
import { NodeMetadata } from './NodeMetadata';

export class NodeUtils {
    /**
     * @param {T} literalNode
     * @returns {T}
     */
    public static addXVerbatimPropertyTo (literalNode: ESTree.Literal): ESTree.Literal {
        literalNode['x-verbatim-property'] = {
            content: literalNode.raw,
            precedence: escodegen.Precedence.Primary
        };

        return literalNode;
    }

    /**
     * @param {T} astTree
     * @returns {T}
     */
    public static clone <T extends ESTree.Node = ESTree.Node> (astTree: T): T {
        return NodeUtils.parentizeAst(NodeUtils.cloneRecursive(astTree));
    }

    /**
     * @param {string} code
     * @returns {Statement[]}
     */
    public static convertCodeToStructure (code: string): ESTree.Statement[] {
        const structure: ESTree.Program = espree.parse(code, { sourceType: 'script' });

        estraverse.replace(structure, {
            enter: (node: ESTree.Node, parentNode: ESTree.Node | null): ESTree.Node => {
                NodeUtils.parentizeNode(node, parentNode);

                if (NodeGuards.isLiteralNode(node)) {
                    NodeUtils.addXVerbatimPropertyTo(node);
                }

                NodeMetadata.set(node, { ignoredNode: false });

                return node;
            }
        });

        return <ESTree.Statement[]>structure.body;
    }

    /**
     * @param {NodeGuards[]} structure
     * @returns {string}
     */
    public static convertStructureToCode (structure: ESTree.Node[]): string {
        return structure.reduce((code: string, node: ESTree.Node) => {
            return code + escodegen.generate(node, {
                sourceMapWithCode: true
            }).code;
        }, '');
    }

    /**
     * @param {UnaryExpression} unaryExpressionNode
     * @returns {NodeGuards}
     */
    public static getUnaryExpressionArgumentNode (unaryExpressionNode: ESTree.UnaryExpression): ESTree.Node {
        if (NodeGuards.isUnaryExpressionNode(unaryExpressionNode.argument)) {
            return NodeUtils.getUnaryExpressionArgumentNode(unaryExpressionNode.argument);
        }

        return unaryExpressionNode.argument;
    }

    /**
     * @param {T} astTree
     * @returns {T}
     */
    public static parentizeAst <T extends ESTree.Node = ESTree.Node> (astTree: T): T {
        estraverse.replace(astTree, {
            enter: NodeUtils.parentizeNode
        });

        return astTree;
    }

    /**
     * @param {T} node
     * @param {Node} parentNode
     * @returns {T}
     */
    public static parentizeNode <T extends ESTree.Node = ESTree.Node> (node: T, parentNode: ESTree.Node | null): T {
        node.parentNode = parentNode || node;

        return node;
    }

    /**
     * @param {T} node
     * @returns {T}
     */
    private static cloneRecursive <T> (node: T): T {
        if (node === null) {
            return node;
        }

        const copy: TObject = {};

        Object
            .keys(node)
            .forEach((property: string) => {
                if (property === 'parentNode') {
                    return;
                }

                const value: T[keyof T] = node[<keyof T>property];

                let clonedValue: T[keyof T] | T[keyof T][] | null;

                if (value === null || value instanceof RegExp) {
                    clonedValue = value;
                } else if (Array.isArray(value)) {
                    clonedValue = value.map(NodeUtils.cloneRecursive);
                } else if (typeof value === 'object') {
                    clonedValue = NodeUtils.cloneRecursive(value);
                } else {
                    clonedValue = value;
                }

                copy[property] = clonedValue;
            });

        return <T>copy;
    }
}
