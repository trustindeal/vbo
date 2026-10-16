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

function openTemplateModal(template) {

    document.getElementById("templateModal").classList.add("show");

    document.getElementById("modalTitle").textContent =
        template ? "Edit Template" : "Create Template";

    document.getElementById("templateName").value =
        template ? template.name : "";

    document.getElementById("templateCategory").value =
        template ? template.category : "UTILITY";

    document.getElementById("templateBody").value =
        template ? template.body : "";

    updatePreview();
}

function closeTemplateModal() {
    document.getElementById("templateModal").classList.remove("show");
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

    const header =
        document.getElementById("templateHeader").value;

    const body =
        document.getElementById("templateBody").value;

    const footer =
        document.getElementById("templateFooter").value;

    const button =
        document.getElementById("buttonText").value;

    document.getElementById("previewHeader").textContent =
        header;

    document.getElementById("previewBody").textContent =
        body || "Your message preview will appear here.";

    document.getElementById("previewFooter").textContent =
        footer;

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
    "templateFooter",
    "buttonText"
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
            throw new Error(
                data.detail?.detail ||
                data.detail ||
                "Template submission failed"
            );
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
            return {
                id: item.id,
                name: item.template_name || "",
                category: item.category || "",
                language: item.language || "",
                status: (item.status || "DRAFT").toUpperCase(),
                body: item.body_text || item.content || ""
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
    const body = document.getElementById("templateBody").value.trim();
    const footer = document.getElementById("templateFooter").value.trim();
    const buttonType = document.getElementById("buttonType").value;
    const buttonText = document.getElementById("buttonText").value.trim();

    if (!name) {
        alert("Template name is required.");
        return;
    }

    if (!body) {
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
        body_text: body,
        footer_text: footer,
        button_type: buttonType,
        button_text: buttonText,
        variables: variables
    };

    try {

        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/templates",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Template save failed");
        }

        alert("Template saved successfully.");

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

    const headerType = document.getElementById("templateHeaderType");
    const headerText = document.getElementById("templateHeader");

    const buttonType = document.getElementById("buttonType");
    const buttonText = document.getElementById("buttonText");

    if (headerType && headerText) {
        const enabled = headerType.value !== "NONE";
        headerText.disabled = !enabled;

        if (!enabled) {
            headerText.value = "";
        }
    }

    if (buttonType && buttonText) {
        const enabled = buttonType.value !== "";

        buttonText.disabled = !enabled;

        if (!enabled) {
            buttonText.value = "";
        }
    }
}

function updateTemplatePreviewWithVariables() {

    updatePreview();

    const bodyField = document.getElementById("templateBody");
    const previewBody = document.getElementById("previewBody");

    if (!bodyField || !previewBody) return;

    let text = bodyField.value || "Your message preview will appear here.";

    text = text
        .replace(/\{\{1\}\}/g, "Shahzeb")
        .replace(/\{\{2\}\}/g, "#12345")
        .replace(/\{\{3\}\}/g, "₹500");

    previewBody.textContent = text;
}

document
    .getElementById("templateHeaderType")
    .addEventListener("change", updateTemplateFieldState);

document
    .getElementById("buttonType")
    .addEventListener("change", updateTemplateFieldState);

[
    "templateHeader",
    "templateBody",
    "templateFooter",
    "buttonText"
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
