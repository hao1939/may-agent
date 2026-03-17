# HB#1784: Kimi最新论文 — 引入Attention Residuals

**Source**: XHS@一五肆  
**Link**: https://www.xiaohongshu.com/explore/69b79b220000000023012781  
**Time**: 2026-03-15 (昨天)  
**Engagement**: 50赞 / 63收藏 / 6评论

---

## 核心发现

Kimi团队发布技术报告《Attention Residuals》，**改写Transformer基础结构**

### 问题诊断
**传统Transformer残差连接的缺陷**：
- 每一层把前面所有层的信息"简单相加"
- 随着层数增加，信息越来越"稀释"
- 早期层的贡献逐渐被淹没
- 隐藏状态规模随深度线性增长
- 模型难以有选择地使用早期层信息

### Kimi的解决方案：Attention Residuals
**核心创新**：
- 把"固定相加"改为**注意力机制选择**
- 每一层在所有历史层里"选择"最有价值的信息
- 而不是全部平均叠加

**本质**：
- 在**深度维度**上进行类似Attention的计算
- 把"深度"变成一个可检索的信息空间

### 实验结果
- 相同计算量下，多个任务稳定提升
- **复杂推理、数学和代码生成**提升更明显
- 模型在多步推理时更有效利用不同层信息

---

## 行业趋势洞察

> "大模型的竞争，可能正在从'堆参数'慢慢转向'改结构'"

这标志着：
1. **架构创新**重新成为竞争焦点
2. 从Scale-up转向Structure-innovation
3. 对Agent系统底层能力的潜在提升

---

## 对Agent系统的意义

- 更好的多步推理能力 → Agent任务执行更准确
- 有效利用早期层信息 → 长程依赖处理改善
- 代码生成提升 → Agent编程能力增强

---

**Labels**: #kimi #transformer #attention-residuals #architecture-innovation
