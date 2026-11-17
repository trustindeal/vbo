const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

let templates = [
    {
        id: 1,
        name: "order_confirmation",
        category: "UTILITY",
        language: "English (US)",
        status: "APPROVED",
        body: "Hello {{1}}, your order {{2}} has been confirmed."
    },
    {
        id: 2,
        name: "payment_received",
        category: "UTILITY",
        language: "English (US)",
        status: "APPROVED",
        body: "Hi {{1}}, we have received your payment of {{2}}."
    },
    {
        id: 3,
        name: "special_offer",
        category: "MARKETING",
        language: "English (US)",
        status: "PENDING",
        body: "Hello {{1}}, we have a special offer for you."
    }
];

let editingTemplateId = null;

const grid = document.getElementById("templateGrid");
const emptyState = document.getElementById("emptyTemplates");

async function loadClientInfo() {
    const savedClient = localStorage.getItem("vbonotif_client");
    const clientNameElement = document.getElementById("clientName");
    const accountStatusElement = document.getElementById("accountStatus");
    const avatarElement = document.querySelector(".account-avatar");

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/auth/me",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load account information.");
        }

        const data = await response.json();
        const clientName = data.client_name || savedClient || "Client";

        if (clientNameElement) {
            clientNameElement.textContent = clientName;
        }

        if (accountStatusElement) {
            accountStatusElement.textContent =
                data.status === "active" ? "Active account" : (data.status || "Account");
        }

        if (avatarElement) {
            avatarElement.textContent = clientName.charAt(0).toUpperCase();
        }

    } catch (error) {
        console.error("Template account info error:", error);

        if (clientNameElement) {
            clientNameElement.textContent = savedClient || "Client";
        }

        if (accountStatusElement) {
            accountStatusElement.textContent = "Account";
        }
    }
}

function renderTemplates() {

    const search =
        document.getElementById("templateSearch").value
            .trim()
            .toLowerCase();

    const category =
        document.getElementById("categoryFilter").value;

    const status =
        document.getElementById("statusFilter").value;

    const filtered = templates.filter(function (template) {

        const matchesSearch =
            !search ||
            template.name.toLowerCase().includes(search) ||
            template.body.toLowerCase().includes(search);

        const matchesCategory =
            !category ||
            template.category === category;

        const matchesStatus =
            !status ||
            template.status === status;

        return matchesSearch &&
            matchesCategory &&
            matchesStatus;
    });

    grid.innerHTML = "";

    if (!filtered.length) {
        emptyState.style.display = "flex";
        return;
    }

    emptyState.style.display = "none";

    filtered.forEach(function (template) {

        const card = document.createElement("div");
        card.className = "template-card";

        const statusClass =
            template.status.toLowerCase();

        card.innerHTML = `
            <div class="template-card-top">
                <div>
                    <h3>${escapeHtml(template.name)}</h3>
                    <div class="template-meta">
                        ${escapeHtml(template.category)}
                        <span>•</span>
                        ${escapeHtml(template.language)}
                    </div>
                </div>

                <span class="template-status ${statusClass}">
                    ${escapeHtml(template.status)}
                </span>
            </div>

            <div class="template-card-body">
                ${escapeHtml(template.body)}
            </div>

            <div class="template-card-footer">

                <button
                    class="template-action"
                    onclick="viewTemplate(${template.id})"
                >
                    View
                </button>

                <button
                    class="template-action"
                    onclick="editTemplate(${template.id})"
                >
                    Edit
                </button>

                
                <button
                    class="template-action"
                    onclick="deleteTemplate(${template.id})"
                >
                    Delete
                </button>
                ${
                    (template.status === "DRAFT" || template.status === "REJECTED")
                    ? `
                        <button
                            class="template-action"
                            onclick="submitTemplateToMeta(${template.id})"
                        >
                            Submit to Meta
                        </button>
                    `
                    : ""
                }

            </div>
        `;

        grid.appendChild(card);
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function parseJsonValue(value, fallback) {
    if (!value) return fallback;
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function updateButtonRowState(row) {
    const type = row.querySelector(".template-button-type").value;
    const valueInput = row.querySelector(".template-button-value");
    const exampleInput = row.querySelector(".template-button-example");

    valueInput.style.display = ["URL", "PHONE_NUMBER", "FLOW"].includes(type) ? "block" : "none";
    exampleInput.style.display = ["URL", "FLOW"].includes(type) ? "block" : "none";

    const placeholders = {
        URL: "https://example.com/{{1}}",
        PHONE_NUMBER: "+919876543210",
        FLOW: "Meta Flow ID"
    };
    valueInput.placeholder = placeholders[type] || "Value";
    exampleInput.placeholder = type === "FLOW" ? "Start screen (optional)" : "Dynamic URL example";
}

function addTemplateButtonRow(button) {
    const container = document.getElementById("templateButtons");
    if (container.children.length >= 10) {
        alert("Meta supports a maximum of 10 buttons in a template component.");
        return;
    }

    const row = document.createElement("div");
    row.className = "template-button-row";
    row.innerHTML = `
        <select class="template-button-type">
            <option value="QUICK_REPLY">Quick Reply</option>
            <option value="URL">Visit Website</option>
            <option value="PHONE_NUMBER">Call Phone</option>
            <option value="FLOW">WhatsApp Flow</option>
            <option value="CATALOG">Open Catalog</option>
        </select>
        <input class="template-button-text" type="text" maxlength="25" placeholder="Button text">
        <input class="template-button-value" type="text" placeholder="Value">
        <input class="template-button-example" type="text" placeholder="Example">
        <button type="button" class="remove-template-button" aria-label="Remove button">×</button>
    `;

    const source = button || {};
    const rawType = String(source.type || "QUICK_REPLY").toUpperCase();
    const type = rawType === "PHONE" ? "PHONE_NUMBER" : rawType;
    row.querySelector(".template-button-type").value = type;
    row.querySelector(".template-button-text").value = source.text || "";
    row.querySelector(".template-button-value").value =
        source.url || source.phone_number || source.flow_id || "";
    row.querySelector(".template-button-example").value =
        Array.isArray(source.example)
            ? (source.example[0] || "")
            : (source.example || source.navigate_screen || "");

    row.querySelector(".template-button-type").addEventListener("change", function () {
        updateButtonRowState(row);
        updateTemplatePreviewWithVariables();
    });
    row.querySelectorAll("input").forEach(function (input) {
        input.addEventListener("input", updateTemplatePreviewWithVariables);
    });
    row.querySelector(".remove-template-button").addEventListener("click", function () {
        row.remove();
        updateTemplatePreviewWithVariables();
    });

    container.appendChild(row);
    updateButtonRowState(row);
}

function renderTemplateButtons(buttons) {
    document.getElementById("templateButtons").innerHTML = "";
    (buttons || []).forEach(addTemplateButtonRow);
}

function readTemplateButtons() {
    return Array.from(document.querySelectorAll(".template-button-row")).map(function (row) {
        const type = row.querySelector(".template-button-type").value;
        const text = row.querySelector(".template-button-text").value.trim();
        const value = row.querySelector(".template-button-value").value.trim();
        const example = row.querySelector(".template-button-example").value.trim();
        const button = { type: type, text: text };

        if (type === "URL") {
            button.url = value;
            if (example) button.example = example;
        } else if (type === "PHONE_NUMBER") {
            button.phone_number = value;
        } else if (type === "FLOW") {
            button.flow_id = value;
            button.flow_action = "NAVIGATE";
            if (example) button.navigate_screen = example;
        }
        return button;
    });
}

function apiErrorMessage(data, fallback) {
    const detail = data && data.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail.message === "string") return detail.message;
    if (detail && typeof detail.meta_title === "string") return detail.meta_title;
    return fallback;
}

function openTemplateModal(template) {
    editingTemplateId = template ? template.id : null;
    document.getElementById("templateModal").classList.add("show");

    document.getElementById("modalTitle").textContent =
        template ? "Edit Template" : "Create Template";

    document.getElementById("templateName").value =
        template ? template.name : "";

    document.getElementById("templateCategory").value =
        template ? template.category : "UTILITY";

    document.getElementById("templateLanguage").value =
        template ? template.language : "en_US";

    document.getElementById("templateHeaderType").value =
        template ? (template.headerType || "NONE") : "NONE";

    document.getElementById("templateHeader").value =
        template ? (template.headerText || "") : "";

    document.getElementById("templateHeaderHandle").value =
        template ? (template.headerHandle || "") : "";

    document.getElementById("templateBody").value =
        template ? template.body : "";

    document.getElementById("templateFooter").value =
        template ? (template.footerText || "") : "";

    const config = template ? (template.config || {}) : {};
    document.getElementById("templateParameterFormat").value =
        config.parameter_format || "POSITIONAL";
    document.getElementById("allowCategoryChange").checked =
        Boolean(config.allow_category_change);
    document.getElementById("templateMessageTtl").value =
        config.message_send_ttl_seconds || "";
    document.getElementById("authSecurityRecommendation").checked =
        config.auth_add_security_recommendation !== false;
    document.getElementById("authCodeExpiry").value =
        config.auth_code_expiration_minutes || 10;
    document.getElementById("authOtpType").value =
        config.auth_otp_type || "COPY_CODE";
    document.getElementById("authButtonText").value =
        config.auth_otp_button_text || "Copy code";
    document.getElementById("advancedComponents").value =
        template && template.components && template.components.length
            ? JSON.stringify(template.components, null, 2)
            : "";

    renderTemplateButtons(template ? template.buttons : []);
    updateTemplateFieldState();
    updateTemplatePreviewWithVariables();
}

function closeTemplateModal() {
    document.getElementById("templateModal").classList.remove("show");
    editingTemplateId = null;
}

function viewTemplate(id) {

    const template =
        templates.find(item => item.id === id);

    if (!template) return;

    openTemplateModal(template);
}

function editTemplate(id) {

    const template =
        templates.find(item => item.id === id);

    if (!template) return;

    openTemplateModal(template);
}
function updatePreview() {
    const category = document.getElementById("templateCategory").value;
    const header =
        document.getElementById("templateHeader").value;

    const body =
        document.getElementById("templateBody").value;

    const footer =
        document.getElementById("templateFooter").value;

    const firstButtonText = document.querySelector(".template-button-text")?.value || "";
    const authOtpType = document.getElementById("authOtpType").value;
    const authButtonText = document.getElementById("authButtonText").value;
    const authExpiry = document.getElementById("authCodeExpiry").value || "10";

    const previewHeader = category === "AUTHENTICATION" ? "" : header;
    const previewBody = category === "AUTHENTICATION"
        ? "123456 is your verification code."
        : (body || "Your message preview will appear here.");
    const previewFooter = category === "AUTHENTICATION"
        ? "This code expires in " + authExpiry + " minutes."
        : footer;
    const button = category === "AUTHENTICATION"
        ? (authOtpType === "NO_BUTTONS" ? "" : authButtonText)
        : firstButtonText;

    document.getElementById("previewHeader").textContent =
        previewHeader;

    document.getElementById("previewBody").textContent =
        previewBody;

    document.getElementById("previewFooter").textContent =
        previewFooter;

    const buttonElement =
        document.getElementById("previewButton");

    buttonElement.textContent = button;
    buttonElement.style.display =
        button ? "block" : "none";
}
document
    .getElementById("templateSearch")
    .addEventListener("input", renderTemplates);

document
    .getElementById("categoryFilter")
    .addEventListener("change", renderTemplates);

document
    .getElementById("statusFilter")
    .addEventListener("change", renderTemplates);

document
    .getElementById("createTemplateButton")
    .addEventListener("click", function () {
        openTemplateModal(null);
    });

document
    .getElementById("syncMetaButton")
    .addEventListener("click", syncMetaTemplates);

async function syncMetaTemplates() {
    const button = document.getElementById("syncMetaButton");

    try {
        button.disabled = true;
        button.textContent = "↻ Syncing...";

        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/templates/sync",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.detail || "Meta sync failed");
        }

        await loadTemplates();
        alert((data.count || 0) + " Meta template(s) synced successfully.");

    } catch (error) {
        console.error("Meta template sync error:", error);
        alert(error.message || "Unable to sync Meta templates.");
    } finally {
        button.disabled = false;
        button.textContent = "↻ Sync Meta";
    }
}

document
    .getElementById("emptyCreateButton")
    .addEventListener("click", function () {
        openTemplateModal(null);
    });

document
    .getElementById("closeTemplateModal")
    .addEventListener("click", closeTemplateModal);

document
    .getElementById("cancelTemplateButton")
    .addEventListener("click", closeTemplateModal);

[
    "templateHeader",
    "templateBody",
    "templateFooter"
].forEach(function (id) {

    document
        .getElementById(id)
        .addEventListener("input", updatePreview);
});

document
    .getElementById("logoutButton")
    .addEventListener("click", async function () {

        try {

            await fetch(
                "https://app.vbo.co.in/api/v1/auth/logout?token=" +
                encodeURIComponent(token),
                {
                    method: "POST"
                }
            );

        } catch (error) {
            console.error("Logout error:", error);
        }

        localStorage.removeItem("vbonotif_token");
        localStorage.removeItem("vbonotif_client");

        window.location.href = "index.html";
    });

loadClientInfo();
loadTemplates();


async function submitTemplateToMeta(id) {
    const template = templates.find(item => item.id === id);

    if (!template) return;

    const confirmed = await window.VBOUI.confirm(
        'Submit "' + template.name + '" to Meta for approval?'
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/templates/" +
            id +
            "/submit",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(apiErrorMessage(data, "Template submission failed"));
        }

        alert(
            "Template submitted to Meta successfully.\\n\\nStatus: " +
            (data.status || "PENDING")
        );

        await loadTemplates();

    } catch (error) {
        console.error("Meta template submit error:", error);
        alert(error.message || "Unable to submit template to Meta.");
    }
}

async function loadTemplates() {
    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/templates",
            {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Template API request failed");
        }

        const data = await response.json();

        templates = (data.templates || []).map(function (item) {
            const legacyButtons = item.button_type ? [{
                type: item.button_type,
                text: item.button_text || "",
                url: item.button_url || ""
            }] : [];
            return {
                id: item.id,
                name: item.template_name || "",
                category: item.category || "",
                language: item.language || "",
                status: (item.status || "DRAFT").toUpperCase(),
                body: item.body_text || item.content || "",
                headerType: item.header_type || "NONE",
                headerText: item.header_text || "",
                headerHandle: item.header_handle || "",
                footerText: item.footer_text || "",
                buttons: parseJsonValue(item.button_list, legacyButtons),
                components: parseJsonValue(item.components_json, []),
                config: parseJsonValue(item.template_config_json, {}),
                metaStatusReason: item.meta_status_reason || ""
            };
        });

        renderTemplates();

    } catch (error) {
        console.error("Template load error:", error);
        templates = [];
        renderTemplates();
    }
}

async function saveTemplate() {

    const name = document.getElementById("templateName").value.trim();
    const category = document.getElementById("templateCategory").value;
    const language = document.getElementById("templateLanguage").value;
    const headerType = document.getElementById("templateHeaderType").value;
    const headerText = document.getElementById("templateHeader").value.trim();
    const headerHandle = document.getElementById("templateHeaderHandle").value.trim();
    let body = document.getElementById("templateBody").value.trim();
    let footer = document.getElementById("templateFooter").value.trim();
    const buttons = category === "AUTHENTICATION" ? [] : readTemplateButtons();
    let advancedComponents = [];

    const advancedComponentsText = document.getElementById("advancedComponents").value.trim();
    if (advancedComponentsText) {
        try {
            advancedComponents = JSON.parse(advancedComponentsText);
            if (!Array.isArray(advancedComponents) || !advancedComponents.length) {
                throw new Error("Advanced components must be a non-empty JSON array.");
            }
        } catch (error) {
            alert(error.message || "Advanced components JSON is invalid.");
            return;
        }
    }

    if (category === "AUTHENTICATION") {
        body = "{{1}} is your verification code.";
        footer = "This code expires in " + (document.getElementById("authCodeExpiry").value || "10") + " minutes.";
    }

    if (!name) {
        alert("Template name is required.");
        return;
    }

    if (!body && !advancedComponents.length) {
        alert("Message body is required.");
        return;
    }

    const variables = [...body.matchAll(/\{\{(\d+)\}\}/g)]
        .map(match => match[1])
        .filter((value, index, array) => array.indexOf(value) === index)
        .join(",");

    const payload = {
        template_name: name,
        language: language,
        category: category,
        header_type: headerType,
        header_text: headerText,
        header_handle: headerHandle,
        body_text: body,
        footer_text: footer,
        button_type: buttons[0]?.type || "",
        button_text: buttons[0]?.text || "",
        button_url: buttons[0]?.url || buttons[0]?.phone_number || "",
        button_list: buttons,
        variables: variables,
        components: advancedComponents,
        parameter_format: document.getElementById("templateParameterFormat").value,
        allow_category_change: document.getElementById("allowCategoryChange").checked,
        message_send_ttl_seconds: document.getElementById("templateMessageTtl").value
            ? Number(document.getElementById("templateMessageTtl").value)
            : null,
        auth_add_security_recommendation: document.getElementById("authSecurityRecommendation").checked,
        auth_code_expiration_minutes: Number(document.getElementById("authCodeExpiry").value || 10),
        auth_otp_type: document.getElementById("authOtpType").value,
        auth_otp_button_text: document.getElementById("authButtonText").value.trim() || "Copy code"
    };

    try {

        const endpoint = "https://app.vbo.co.in/api/v1/whatsapp/templates" +
            (editingTemplateId ? "/" + editingTemplateId : "");
        const response = await fetch(
            endpoint,
            {
                method: editingTemplateId ? "PUT" : "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(apiErrorMessage(data, "Template save failed"));
        }

        alert(editingTemplateId ? "Template updated successfully." : "Template saved successfully.");

        closeTemplateModal();
        await loadTemplates();

    } catch (error) {

        console.error("Template save error:", error);
        alert(error.message || "Unable to save template.");

    }
}

document
    .getElementById("saveTemplateButton")
    .addEventListener("click", saveTemplate);
/* Template UX Polish */
function updateTemplateFieldState() {
    const category = document.getElementById("templateCategory").value;
    const headerType = document.getElementById("templateHeaderType");
    const headerText = document.getElementById("templateHeader");
    const isAuthentication = category === "AUTHENTICATION";
    const isMediaHeader = ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType.value);

    document.getElementById("authenticationFields").classList.toggle("is-hidden", !isAuthentication);
    document.getElementById("templateBodyField").classList.toggle("is-hidden", isAuthentication);
    document.getElementById("templateFooterField").classList.toggle("is-hidden", isAuthentication);
    document.getElementById("templateButtonsField").classList.toggle("is-hidden", isAuthentication);
    headerType.closest(".template-field").classList.toggle("is-hidden", isAuthentication);

    document.getElementById("headerTextField").classList.toggle(
        "is-hidden",
        isAuthentication || headerType.value !== "TEXT"
    );
    document.getElementById("headerHandleField").classList.toggle(
        "is-hidden",
        isAuthentication || !isMediaHeader
    );
    headerText.disabled = isAuthentication || headerType.value !== "TEXT";
    document.getElementById("templateHeaderHandle").disabled = isAuthentication || !isMediaHeader;

    const noOtpButton = document.getElementById("authOtpType").value === "NO_BUTTONS";
    document.getElementById("authButtonTextField").classList.toggle("is-hidden", noOtpButton);
    updateTemplatePreviewWithVariables();
}

function updateTemplatePreviewWithVariables() {

    updatePreview();

    const bodyField = document.getElementById("templateBody");
    const previewBody = document.getElementById("previewBody");

    if (!bodyField || !previewBody) return;

    if (document.getElementById("templateCategory").value === "AUTHENTICATION") return;

    let text = bodyField.value || "Your message preview will appear here.";

    text = text
        .replace(/\{\{1\}\}/g, "Shahzeb")
        .replace(/\{\{2\}\}/g, "#12345")
        .replace(/\{\{3\}\}/g, "₹500")
        .replace(/\{\{[a-z][a-z0-9_]*\}\}/gi, "Example");

    previewBody.textContent = text;
}

document
    .getElementById("templateHeaderType")
    .addEventListener("change", updateTemplateFieldState);

document
    .getElementById("templateCategory")
    .addEventListener("change", updateTemplateFieldState);

document
    .getElementById("authOtpType")
    .addEventListener("change", updateTemplateFieldState);

document
    .getElementById("addTemplateButton")
    .addEventListener("click", function () {
        addTemplateButtonRow({ type: "QUICK_REPLY" });
    });

[
    "templateHeader",
    "templateBody",
    "templateFooter",
    "authButtonText",
    "authCodeExpiry"
].forEach(function (id) {

    const element = document.getElementById(id);

    if (element) {
        element.addEventListener(
            "input",
            updateTemplatePreviewWithVariables
        );
    }
});

updateTemplateFieldState();
updateTemplatePreviewWithVariables();
async function deleteTemplate(id) {
    const template = templates.find(item => item.id === id);

    if (!template) return;

    const confirmed = await window.VBOUI.confirm(
        'Delete "' + template.name + '"?\n\n' +
        'If this template exists on Meta, it will be deleted from Meta first.'
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/templates/" +
            id,
            {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.detail?.message ||
                data.detail ||
                "Template deletion failed"
            );
        }

        alert("Template deleted successfully.");

        await loadTemplates();

    } catch (error) {
        console.error("Template delete error:", error);
        alert(error.message || "Unable to delete template.");
    }
}
