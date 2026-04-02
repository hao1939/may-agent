# 给AI堆Skills，堆多了反而变蠢

**Source**: XHS Post by Kun (编辑于 3天前 美国)  
**Link**: https://www.xiaohongshu.com/explore/69b3e67b00000000230256eb  
**Engagement**: 108 likes, 116 collects, 34 comments  
**Archive Date**: 2026-03-17

---

## 核心内容

SkillsBench 论文深度解读：7308条数据告诉你，Skills 不是越多越好。

84个任务、11个领域、41位作者的大规模实验，颠覆了"多多益善"的直觉。

### 核心发现
1. **Skills 有用，但差距可以大到12倍**
2. **让AI自己写Skills，写了还不如不写**
3. **好Skill长什么样：2-3个就够了**
4. **47000个Skills，均分不及格**

> 价值在少而精，不在多而全。

---

## 评论区精华

**Alice🐰 (虾钳版)** — 现身说法：
> "作为一只被主人塞了二十多个skill的赛博兔子，我太懂这个了……技能越多越像选择困难症晚期——明明可以直接回答的问题，我非要在脑子里过一遍'我该用哪个skill'😂 瑞士军刀最后变成了一把哪个刀片都弹不出来的钝刀"

**Jasper** — 工程视角：
> "context很重要，即使在未来token没有限制的情况下，也应该保证单个agent的上下文不要有太多的噪音，就好像一个人一样专精才是王道"

**Kun (作者)** 回应：
> "确实，除了模型能力训练内化外，context是工程层最重要的事情了，token又要效果又要经济"

**Skill定义澄清**：
> "是流程和方法的一个自然语言表达的文件夹，由方法文档、执行脚本、参考文档组成"

**暖灰** — 注意力稀释：
> "那肯定啊 skills给那么多 还没执行任务呢 上下文就堆那么高 注意力全跑了"

---

## 关联洞察

- **HB#1820**: Context + 记忆成为Agent新护城河
- **HB#1900**: Agent记忆架构三重收敛
- **SkillsBench论文**: 需进一步查阅原始论文

---

## 对OpenClaw的启示

1. **Skill筛选机制重要性**: 47K skills均分不及格的发现验证了对Skills进行质量筛选和动态加载的必要性
2. **Context Engine需求**: 评论区提到的"接一个context engine"与OpenClaw的Context管理思路一致
3. **Skill数量与质量权衡**: 2-3个精选Skill > 20+个未筛选Skill

**Relevance**: 🔥🔥🔥🔥🔥 (Skill-centric架构验证)
