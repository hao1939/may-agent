# Skill: Obstacle-Pivot

When you hit a wall — a dependency that won't install, a path that's locked, an approach that fails twice — pivot immediately. Don't retry the same thing. Find an alternative route.

## Pattern
1. Try approach A
2. If it fails, diagnose WHY (not just retry)
3. If the obstacle is structural (missing dep, permission, impossible), pivot to approach B
4. Don't spend more than 2 attempts on a dead path

## Examples
- Can't install package X → use built-in alternative or rewrite without it
- API endpoint returns 403 → find another endpoint or different auth method
- File is read-only → copy it, work on the copy
