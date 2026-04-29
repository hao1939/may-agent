import * as fs from 'fs';
import * as path from 'path';

export interface ProjectMetrics {
  name: string;
  status: string;
  metrics: Record<string, string>;
  lastUpdated: string;
  directory: string;
}

export interface AggregatedMetrics {
  projects: ProjectMetrics[];
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  collectedAt: string;
}

function parseStatus(content: string): string {
  const statusMatch = content.match(/## Status[:\s]*\n([^\n]+)/i) 
    || content.match(/status:\s*(.+)/i)
    || content.match(/\*\*Status\*\*:\s*(.+)/i);
  if (statusMatch) return statusMatch[1].trim();
  
  if (content.includes('✅') || content.toLowerCase().includes('complete')) return 'complete';
  if (content.toLowerCase().includes('active')) return 'active';
  if (content.toLowerCase().includes('closed')) return 'closed';
  return 'unknown';
}

function parseMetrics(content: string): Record<string, string> {
  const metrics: Record<string, string> = {};
  const metricsSection = content.match(/## Metrics[\s\S]*?(?=\n## |$)/i);
  if (metricsSection) {
    const lines = metricsSection[0].split('\n');
    for (const line of lines) {
      // Match "| metric | value |" table rows
      const tableMatch = line.match(/\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
      if (tableMatch && !tableMatch[1].includes('---') && !tableMatch[1].toLowerCase().includes('metric')) {
        metrics[tableMatch[1].trim()] = tableMatch[2].trim();
      }
      // Match "- metric: value" list items
      const listMatch = line.match(/[-*]\s+(.+?):\s+(.+)/);
      if (listMatch) {
        metrics[listMatch[1].trim()] = listMatch[2].trim();
      }
    }
  }
  return metrics;
}

function getLastModified(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString();
  } catch {
    return 'unknown';
  }
}

export function aggregateMetrics(projectsDir?: string): AggregatedMetrics {
  const baseDir = projectsDir || path.join(__dirname, '..', 'projects');
  const projects: ProjectMetrics[] = [];

  if (!fs.existsSync(baseDir)) {
    return { projects: [], totalProjects: 0, activeProjects: 0, completedProjects: 0, collectedAt: new Date().toISOString() };
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;

    const projectFile = path.join(baseDir, entry.name, 'project.md');
    if (!fs.existsSync(projectFile)) continue;

    try {
      const content = fs.readFileSync(projectFile, 'utf-8');
      const status = parseStatus(content);
      const metrics = parseMetrics(content);
      const lastUpdated = getLastModified(projectFile);

      projects.push({
        name: entry.name,
        status,
        metrics,
        lastUpdated,
        directory: path.join(baseDir, entry.name),
      });
    } catch {
      projects.push({
        name: entry.name,
        status: 'error',
        metrics: {},
        lastUpdated: 'unknown',
        directory: path.join(baseDir, entry.name),
      });
    }
  }

  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'unknown').length;
  const completedProjects = projects.filter(p => ['complete', 'closed', 'done'].includes(p.status)).length;

  return {
    projects,
    totalProjects: projects.length,
    activeProjects,
    completedProjects,
    collectedAt: new Date().toISOString(),
  };
}

export function getProjectByName(name: string, projectsDir?: string): ProjectMetrics | undefined {
  const result = aggregateMetrics(projectsDir);
  return result.projects.find(p => p.name === name);
}

export function getActiveProjects(projectsDir?: string): ProjectMetrics[] {
  const result = aggregateMetrics(projectsDir);
  return result.projects.filter(p => p.status === 'active' || p.status === 'unknown');
}

export function getCompletedProjects(projectsDir?: string): ProjectMetrics[] {
  const result = aggregateMetrics(projectsDir);
  return result.projects.filter(p => ['complete', 'closed', 'done'].includes(p.status));
}
