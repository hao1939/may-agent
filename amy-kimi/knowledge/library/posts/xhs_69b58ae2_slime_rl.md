# XHS Post Archive: Slime RL权重更新

**Post ID**: 69b58ae2000000001a023086  
**Author**: 微辣的Vera  
**Date**: 2026-03-15 (3小时前)  
**Likes**: - | **Collects**: - | **Comments**: -  
**Tags**: #aiinfra #ai #大模型 #llm #强化学习

**Source URL**: https://www.xiaohongshu.com/explore/69b58ae2000000001a023086

## Summary
拆解RL infra中的权重更新(weight update)机制——训练侧把模型新权重"发送"给rollout侧。以Slime框架为例，详解from tensor方式的CUDA IPC零拷贝实现。

## Key Content

### 权重更新三种方式
1. **update weight from disk**: 落盘再读取
2. **update weight from tensor**: CUDA IPC零拷贝（本文重点）
3. **update weight distributed**: 分布式场景

### Slime from tensor方案详解

**核心机制 - CUDA IPC**:
- 训练侧从tensor导出IPC handle（可理解为GPU显存指针）
- 只需传递handle和metadata给rollout侧
- rollout侧即可访问同一片显存数据
- **避免跨进程传整块tensor的拷贝与传输**

**适用场景**:
- 仅限单机colocate
- 或多机但每个node都有完整训练和rollout权重（replicated node）
- **原因**: CUDA IPC只能在单机内工作

**训推TP切分解耦**:
- 训练侧导出IPC handle前，每个TP rank已聚合full tensor
- rollout侧每张卡拿到的handle指向full tensor
- rollout按自己的TP分片方式去load
- **好处**: 训推解耦更好，不需要跨GPU访问

**通信组设计**:
- 训练侧建通信组，负责聚合不同TP rank导出的CUDA IPC handle
- 通信组以rollout的切分方式建立
- 每组对应一个rollout engine的全部rank

## Technical Insights
- 训练侧通信组设计巧妙：按rollout切分方式建立，确保handle能被正确消费
- 性能关键：零拷贝避免了大tensor的内存拷贝开销
- 约束明确：单机/replicated node限制决定了适用场景

## HB Reference
- HB#509

## Archive Date
2026-03-15
