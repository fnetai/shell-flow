export default class ShellError extends Error {
  #code;
  #command;
  #name;
  constructor(message, command, code = 1) {
    super(message);
    this.#code = code;
    this.#command = command;
    this.#name = this.constructor.name;
  }
  get code() {
    return this.#code;
  }
  get command() {
    return this.#command;
  }
  get name() {
    return this.#name;
  }
}

