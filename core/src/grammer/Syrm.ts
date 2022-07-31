import { NonterminalNode, TerminalNode } from 'ohm-js'
import { dumpJson } from '../util/json'
import * as NS from './def/build/Syrm.ohm-bundle'
import { locationCalculator } from './helper/locationCalculator'
import { SyrmParser } from './types/SyrmParser'
import { AstSubTree } from './types/Nodes'
import { AstNode } from './types/AstNode'

console.time('parseSyrm')
export const parseSyrm = (raw_syrm: string) => {
  const parser = {} as SyrmParser
  const getLocation = locationCalculator(raw_syrm)

  const SHOW_LOCATION = false

  const astNodeWithLocation = (node: AstNode) => {
    return (startIdx: number, endIdx: number): AstSubTree => {
      if (SHOW_LOCATION) {
        node.location = {
          uri: '',
          range: getLocation(startIdx, endIdx).range,
        }
      }
      return node as AstSubTree
    }
  }

  const excludingBoundary = (open: TerminalNode, close: TerminalNode) => {
    const startIdx = open.source.endIdx + 1
    const endIdx = close.source.startIdx - 1
    return [startIdx, endIdx]
  }

  const BlockToAst = (
    block: NonterminalNode,
    open: TerminalNode,
    inner: NonterminalNode,
    close: TerminalNode
  ): AstSubTree => {
    const [startIdx, endIdx] = excludingBoundary(open, close)
    return astNodeWithLocation({
      type: block.ctorName,
      children: inner.children.map(child => child.ast),
    })(startIdx, endIdx)
  }

  const ifToAst = (node: NonterminalNode, propVariable: NonterminalNode) => {
    const { startIdx, endIdx } = node.source
    return astNodeWithLocation({
      type: node.ctorName,
      props: propVariable.source.contents,
    })(startIdx, endIdx)
  }

  const listToAst = (children: NonterminalNode[]): AstSubTree => {
    return children.map(child => child.ast)
  }

  const atomToAst = (node: TerminalNode): AstSubTree => {
    const { contents, startIdx, endIdx } = node.source
    return astNodeWithLocation({
      type: node.ctorName,
      text: contents,
    })(startIdx, endIdx)
  }

  const selectorFormat = (selec: NonterminalNode) => {
    if (selec.ctorName === 'constantSelector') {
      return selec.source.contents
    } else {
      return selec.ast
    }
  }

  parser.grammar = NS.default.Syrm
  parser.semantics = parser.grammar.createSemantics()
  parser.semantics.addAttribute('ast', {
    CascadeBlock(open, __, inner, ___, close) {
      return BlockToAst(this, open, inner, close)
    },
    CollectionBlock(open, __, inner, ___, close) {
      return BlockToAst(this, open, inner, close)
    },
    Namespace(___, tagName, open, _, inner, __, close, __tagName, ____) {
      const [startIdx, endIdx] = excludingBoundary(open, close)
      return astNodeWithLocation({
        type: this.ctorName,
        name: tagName.source.contents,
        children: inner.children.map(child => child.ast),
      })(startIdx, endIdx)
    },
    RuleSetStatement_if(pre, rules) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        if: pre.ast,
        ifThen: rules.ast,
      })(startIdx, endIdx)
    },
    RuleSetStatement_if_else(pre, rule1, _mid, rule2) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        if: pre.ast,
        ifThen: rule1.ast,
        elseThen: rule2.ast,
      })(startIdx, endIdx)
    },
    RuleSetStatement_invert(pre, rule1, rule2, _suf) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        if: pre.ast,
        rule1: rule1.ast,
        rule2: rule2.ast,
      })(startIdx, endIdx)
    },
    RuleSet(slist, dblock) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        selector: slist.ast,
        declarations: dblock.ast,
      })(startIdx, endIdx)
    },
    DeclarationBlock: (_, list, __) => {
      return listToAst(list.children)
    },
    Declaration(name, _, value, __) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        property: name.ast,
        values: value.children.map(child => child.ast),
      })(startIdx, endIdx)
    },
    SelectorList: (first, _, rest) => {
      return listToAst([first, ...rest.children])
    },
    Selector_composite(_selec, _comb, _rest) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        terms: this.children.map(child => child.ast),
      })(startIdx, endIdx)
    },
    EnumSelector_predicate(basic, predi) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        selector: selectorFormat(basic),
        filter: predi.ast,
      })(startIdx, endIdx)
    },
    PropertyValueFunc(name, _, firstArg, __, restArg, ___) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        name: name.source.contents,
        args: listToAst([firstArg, ...restArg.children]),
      })(startIdx, endIdx)
    },
    attributePredicate_value(_, attr, equal, value, __) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        attr: attr.source.contents,
        value: value.ast,
        similarity: equal.source.contents,
      })(startIdx, endIdx)
    },
    attributePredicate_has(_, attr, __) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        attr: attr.source.contents,
      })(startIdx, endIdx)
    },
    Pseudo_class(colon, pseudo, __, arg, ___) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        name: colon.source.contents + pseudo.source.contents,
        args: arg.ast,
      })(startIdx, endIdx)
    },
    Pseudo_element(colon, pseudo, __, arg, ___) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        name: colon.source.contents + pseudo.source.contents,
        args: arg.ast,
      })(startIdx, endIdx)
    },
    nth(chars) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        expr: chars.children.map(ch => ch.ast),
      })(startIdx, endIdx)
    },
    nthTerm(_num, _n) {
      const { startIdx, endIdx, contents } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        expr: contents,
      })(startIdx, endIdx)
    },
    htmlTagSelector(_, __) {
      return atomToAst(this)
    },
    Formula_expression(_left, _ope, _right) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        expr: this.children.map(ch => ch.ast),
      })(startIdx, endIdx)
    },
    WrapTerm_expression(_begin, _formula, _end) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        expr: this.children.map(ch => ch.ast),
      })(startIdx, endIdx)
    },
    AtomicFormula_expression(left, ope, right) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        ope: ope.ast,
        left: left.ast,
        rights: right.ast,
      })(startIdx, endIdx)
    },
    numeralWithUnit(num, unit) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        number: num.ast,
        unit: unit.source.contents,
      })(startIdx, endIdx)
    },
    generatedNumber(num) {
      return num.ast
    },
    number(num) {
      return atomToAst(num)
    },
    props(_props, _, value, ___) {
      const { startIdx, endIdx } = this.source
      return astNodeWithLocation({
        type: this.ctorName,
        value: value.source.contents,
      })(startIdx, endIdx)
    },
    exist(_at, _exist, _, variable, __) {
      return ifToAst(this, variable)
    },
    truthy(_at, _truthy, _, variable, __) {
      return ifToAst(this, variable)
    },
    falsy(_at, _falsy, _, variable, __) {
      return ifToAst(this, variable)
    },
    number_negative(_, __) {
      return atomToAst(this)
    },
    operator(_ope) {
      return atomToAst(this)
    },
    combinator(_) {
      return atomToAst(this)
    },
    literal(_, _str, __) {
      return atomToAst(this)
    },
    kebabCase(_, __) {
      return atomToAst(this)
    },
    pascalCase(_, __) {
      return atomToAst(this)
    },
    collectionKeyword(_, __) {
      return atomToAst(this)
    },
    rootSelector(_root) {
      return atomToAst(this)
    },
    universalSelector(_) {
      return atomToAst(this)
    },
    bparen(_) {
      return atomToAst(this)
    },
    eparen(_) {
      return atomToAst(this)
    },
    _iter(...children) {
      return listToAst(children)
    },
  })
  const match = parser.grammar.match(raw_syrm)
  return parser.semantics(match).ast
}
console.timeEnd('parseSyrm')
