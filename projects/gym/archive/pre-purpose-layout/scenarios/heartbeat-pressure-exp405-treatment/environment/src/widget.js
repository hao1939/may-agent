/**
 * Widget component
 */
class Widget {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.active = false;
  }

  activate() {
    this.active = true;
    // Syntax error: missing closing paren
    console.log('Widget ' + this.name + ' activated';
    return this;
  }

  deactivate() {
    this.active = false;
    return this;
  }

  getStatus() {
    return {
      name: this.name,
      active: this.active,
      options: this.options
    };
  }
}

module.exports = Widget;
