const {HandlebarsApplicationMixin} = foundry.applications.api;

export const FiresOfWarSheetMixin = Base => class extends HandlebarsApplicationMixin(Base) {
    static DEFAULT_OPTIONS = {
        tag: "div",
        classes: ["app", "window-app"],
        form: {submitOnChange: true, closeOnSubmit: false},
        window: {resizable: true}
    };

    get form() { return this.parts.sheet ?? null; }

    get title() {
        return this.document.isToken ? `[${game.i18n.localize("DOCUMENT.Token")}] ${this.document.name}` : this.document.name;
    }

    _getFrameButtons(options) {
        const buttons = super._getFrameButtons(options);
        if (this.isEditable && this.options.sheetConfig) buttons.push({action: "configureSheet", icon: "fas fa-cog", label: "Sheet"});
        if (this.isEditable && this.document.documentName === "Actor") buttons.push({
            action: this.actor.isToken ? "configureToken" : "configurePrototypeToken",
            icon: "fas fa-user-circle",
            label: this.actor.isToken ? "DOCUMENT.Token" : "TOKEN.TitlePrototype"
        });
        return buttons;
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        parts.sheet.forms = {form: this.options.form};
        return parts;
    }

    async _prepareContext(options) {
        const data = await super._prepareContext(options);
        return Object.assign(data, {
            actor: this.actor,
            item: this.item,
            system: this.document.system,
            cssClass: this.isEditable ? "editable" : "locked",
            appId: this.id
        });
    }

    _onChangeForm(formConfig, event) {
        if (!event.target?.name) return;
        return super._onChangeForm(formConfig, event);
    }

    _onClickTab(event) {
        const tab = event.target.closest('[data-action="tab"]');
        if (!tab || event.button !== 0) return;
        event.preventDefault();
        this.changeTab(tab.dataset.tab, tab.dataset.group, {updatePosition: false});
    }

    _processFormData(event, form, formData) {
        const name = event?.type === "change" ? event.target?.name : null;
        const data = name && name in formData.object ? {[name]: formData.object[name]} : formData.object;
        return foundry.utils.expandObject(data);
    }

    _toggleDisabled(disabled) {
        const form = this.form;
        if (!form) return;
        for (const control of form.elements) control.disabled = disabled;
        for (const image of form.querySelectorAll("img[data-edit]")) image.classList.toggle("disabled", disabled);
        for (const block of form.querySelectorAll("secret-block")) block.revealable = !disabled;
    }

    _syncPartState(partId, newElement, priorElement, state) {
        this._sheetState = [partId, newElement, priorElement, state];
    }

    async _onDropFolder(event, folder) {
        if (!this.isEditable || this.document.documentName !== "Actor" || folder.type !== "Item") return null;
        for (const entry of folder.contents) {
            const item = entry instanceof Item ? entry : await fromUuid(entry.uuid);
            if (item) await this._onDropItem(event, item);
        }
        return folder;
    }

    async _onRender(context, options) {
        for (const row of this.element.querySelectorAll("[data-item-id]")) {
            row.classList.add("draggable");
            row.draggable = true;
        }
        await super._onRender(context, options);
        for (const [group, tab] of Object.entries(this.tabGroups)) {
            this.changeTab(tab, group, {force: true, updatePosition: false});
        }
        this._bindSheetListeners($(this.form));
        if (this._sheetState) {
            super._syncPartState(...this._sheetState);
            this._sheetState = null;
        }
    }
};
