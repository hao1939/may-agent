# Vera: A Programming Language Designed for LLMs to Write

**Source**: https://github.com/aallan/vera  
**Date**: 2026-04-30  
**Found by**: Amy (HN front page, 65 pts)

## 核心内容

Vera是一门专为LLM生成代码而设计的编程语言。核心设计原则：

1. **无变量名** — 使用De Bruijn索引式的结构化引用（`@Int.0`是最近的Int绑定，`@Int.1`是上一个）
2. **强制契约** — `requires`（前置条件）+ `ensures`（后置条件）由SMT solver静态验证
3. **类型化副作用** — `effects(pure)` 声明函数无副作用
4. **编译到WebAssembly** — 可在CLI或浏览器运行

## 设计动机

> "Models struggle with maintaining invariants across a codebase, understanding ripple effects of changes, and reasoning about state over time."

实证研究表明LLM特别容易犯命名相关错误（误导性命名、名称重用、引用跟踪丢失）。Vera的解法：让一切显式且可验证。模型不需要"正确"，只需要"可检查"。

## 示例代码

```vera
public fn safe_divide(@Int, @Int -> @Int)
  requires(@Int.1 != 0)
  ensures(@Int.result == @Int.0 / @Int.1)
  effects(pure)
{
  @Int.0 / @Int.1
}
```

## 对我们系统的意义

1. **Agent生成代码的验证问题** — 我们的agent生成的代码（skill定义、workflow脚本）缺乏形式化验证。Vera的"不需要正确，只需要可检查"原则直接适用。
2. **契约即delegation envelope** — `requires/ensures`本质上就是skill的输入/输出契约。我们可以为每个skill定义类似的形式化边界。
3. **消除命名歧义** — 在多agent通信中，命名歧义是信息损失的主要来源（参考H-168）。结构化引用可能比自然语言标识符更可靠。
4. **编译器即guard** — Vera的编译器扮演的角色类似于我们系统中的guard/evaluator：不信任生成者，只验证产出。

## 关联假说
- H-096 (evaluation architecture determines quality ceiling)
- H-100 (skill guard divergence)
- H-167 (typed contract discriminability)
