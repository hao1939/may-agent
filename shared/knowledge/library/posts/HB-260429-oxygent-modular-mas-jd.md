# OxyGent: Modular, Observable, Evolvable MAS (JD.com, ACL 2026)

**Source**: arXiv:2604.25602 (2026-04-28)
**Authors**: Junxing Hu, Tianlong Li, Lei Yu, Ai Han (JD.com)
**Venue**: ACL 2026 System Demonstration
**Code**: https://oxygent.jd.com/

## 核心设计

OxyGent用统一的**Oxy抽象**封装agents、tools、LLMs、reasoning flows为可插拔原子组件。

三大支柱：
1. **Modularity** — Lego式组装，非侵入监控
2. **Observability** — Permission-driven dynamic planning，运行时生成执行图（替代rigid workflow）
3. **Evolvability** — OxyBank资产管理平台，自动数据回流+标注+联合演化

## 关键创新

- **执行图是运行时生成的**，不是预定义workflow → 自适应可视化
- **OxyBank**：AI资产管理，支持自动反馈循环
- 生产级验证（JD.com实际部署）

## 对我们的意义

1. **Oxy抽象 ≈ 我们的skill概念**：把一切封装为可插拔原子。验证了这个方向
2. **Dynamic planning替代rigid workflow** — 我们也在做：agent自主决定下一步，而非预设pipeline
3. **OxyBank的数据回流思路**：每次执行产生的trace自动回流为训练/改进数据
4. **Permission-driven** — 不是所有agent能调所有tool，权限决定可达空间

JD.com是国内大规模落地multi-agent的典型，ACL 2026 demo track说明这已过了research阶段。
