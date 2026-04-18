// template-engine.ts — Simple mustache-style template renderer

interface Template {
  name: string;
  subject: string;
  body: string;
}

export class TemplateEngine {
  private templates: Map<string, Template> = new Map();

  register(name: string, subject: string, body: string): void {
    this.templates.set(name, { name, subject, body });
  }

  render(templateName: string, data: Record<string, string>): string | null {
    const template = this.templates.get(templateName);
    if (!template) return null;

    let result = template.body;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      result = result.replaceAll(placeholder, value);
    }

    return result;
  }

  renderSubject(templateName: string, data: Record<string, string>): string | null {
    const template = this.templates.get(templateName);
    if (!template) return null;

    let result = template.subject;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      result = result.replaceAll(placeholder, value);
    }

    return result;
  }

  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }

  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  removeTemplate(name: string): boolean {
    return this.templates.delete(name);
  }
}
