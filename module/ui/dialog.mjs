export class FiresOfWarDialog extends foundry.applications.api.DialogV2 {
    static KEEP_OPEN = Symbol("keepOpen");

    static DEFAULT_OPTIONS = {
        classes: ["app", "window-app", "feue-dialog"],
        position: {width: 400}
    };

    constructor({render, close, content = "", ...options}) {
        const html = typeof content === "string" ? document.createElement("div") : content;
        if (typeof content === "string") html.innerHTML = content;
        super({...options, content: html});
        if (render) this.addEventListener("render", event => render(event, this));
        if (close) this.addEventListener("close", event => close(event, this));
    }

    async _renderHTML(context, options) {
        const form = await super._renderHTML(context, options);
        form.classList.remove("standard-form");
        form.querySelector(".dialog-content")?.classList.remove("standard-form");
        const footer = form.querySelector(".form-footer");
        footer.className = "dialog-buttons";
        for (const button of footer.querySelectorAll("button")) {
            const config = this.options.buttons[button.dataset.action];
            button.classList.add("dialog-button", button.dataset.action);
            if (config.default) button.classList.add("default", "bright");
            button.dataset.button = button.dataset.action;
        }
        return form;
    }

    async _onSubmit(target, event) {
        event.preventDefault();
        if (this._submitting) return;
        const button = this.options.buttons[target?.dataset.action];
        if (!button) return;
        this._submitting = true;
        const buttons = Array.from(this.element.querySelectorAll(".dialog-buttons button"), el => [el, el.disabled]);
        for (const [el] of buttons) el.disabled = true;
        try {
            const result = await button.callback?.(event, target, this);
            if (result === FiresOfWarDialog.KEEP_OPEN) return;
            await this.options.submit?.(result ?? button.action, this);
            if (this.options.form.closeOnSubmit) await this.close({submitted: true});
        } catch (error) {
            console.error("FEUE | Dialog failed", error);
            ui.notifications.error(error.message);
        } finally {
            for (const [el, disabled] of buttons) el.disabled = disabled;
            this._submitting = false;
        }
    }
}
