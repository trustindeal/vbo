const token = localStorage.getItem("vbonotif_token");

if (!token) window.location.href = "index.html";

const API_BASE = "https://app.vbo.co.in/api/v1/whatsapp";
let allContacts = [];
let selectedContactIds = new Set();
let pendingDeleteIds = [];
let contactEditorMode = "edit";

function showContactAlert(message, options) {
    if (window.VBOUI && typeof window.VBOUI.alert === "function") {
        return window.VBOUI.alert(message, options || {});
    }
    window.alert(message);
    return Promise.resolve(true);
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDate(value) {
    if (!value || value === "-") return "-";
    return window.VBOTime ? window.VBOTime.dateTimeFull(value) : value;
}

function getVisibleContacts() {
    const query = String(document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const dndFilter = document.getElementById("dndFilter")?.value || "all";
    return allContacts.filter(contact => {
        const isDnd = Number(contact.marketing_dnd || 0) === 1;
        if (dndFilter === "dnd" && !isDnd) return false;
        if (dndFilter === "allowed" && isDnd) return false;
        if (!query) return true;
        return [contact.name, contact.profile_name, contact.wa_id, contact.phone_number,
            contact.email, contact.city, contact.project_name, ...(contact.group_names || [])]
            .join(" ").toLowerCase().includes(query);
    });
}

function applyContactFilter() {
    renderContacts(getVisibleContacts());
}

function loadClientName() {
    const clientName = localStorage.getItem("vbonotif_client");
    const element = document.getElementById("clientName");
    if (element && clientName) element.textContent = clientName;
}

async function apiRequest(path, options) {
    const response = await fetch(API_BASE + path, {
        ...(options || {}),
        headers: {
            "Authorization": "Bearer " + token,
            ...((options && options.body) ? {"Content-Type": "application/json"} : {}),
            ...((options && options.headers) || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Request failed.");
    return data;
}

async function loadContacts() {
    try {
        const data = await apiRequest("/inbox/contacts");
        allContacts = Array.isArray(data) ? data : (data.contacts || []);
        const validIds = new Set(allContacts.map(contact => Number(contact.id)));
        selectedContactIds = new Set([...selectedContactIds].filter(id => validIds.has(id)));
        applyContactFilter();
    } catch (error) {
        console.error("CONTACT LOAD ERROR:", error);
        document.getElementById("contactsList").innerHTML =
            '<div class="error-state">Unable to load contacts.</div>';
        document.getElementById("contactSummary").textContent = "Unable to load contacts";
    }
}

function renderContacts(contacts) {
    const container = document.getElementById("contactsList");
    const total = allContacts.length;
    document.getElementById("contactSummary").textContent =
        `${contacts.length}${contacts.length !== total ? ` of ${total}` : ""} ${contacts.length === 1 ? "contact" : "contacts"}`;

    if (!contacts.length) {
        container.innerHTML = '<div class="empty-state">No contacts found.</div>';
        updateSelectionUi(contacts);
        return;
    }

    container.innerHTML = contacts.map(contact => {
        const id = Number(contact.id);
        const name = contact.name || contact.profile_name || contact.wa_id || "Unknown";
        const waId = contact.wa_id || contact.phone_number || "";
        const initial = name.trim().charAt(0).toUpperCase() || "?";
        const isDnd = Number(contact.marketing_dnd || 0) === 1;
        const historyCount = Number(contact.message_count || 0);
        return `
            <div class="contact-row" data-contact-id="${id}">
                <div class="contact-select-cell">
                    <input type="checkbox" class="contact-checkbox" data-contact-id="${id}"
                        ${selectedContactIds.has(id) ? "checked" : ""} aria-label="Select ${escapeHtml(name)}">
                </div>
                <div class="contact-name">
                    <div class="contact-avatar">${escapeHtml(initial)}</div>
                    <div class="contact-name-text"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(waId)}</small></div>
                </div>
                <div class="contact-number">${escapeHtml(waId)}</div>
                <div>
                    <button type="button" class="dnd-toggle ${isDnd ? "is-dnd" : "is-allowed"}"
                        data-contact-id="${id}" data-enable="${isDnd ? "0" : "1"}"
                        title="${isDnd ? "Allow marketing messages" : "Stop marketing messages"}">
                        ${isDnd ? "DND" : "Allowed"}
                    </button>
                </div>
                <div class="contact-last">${escapeHtml(formatDate(contact.last_message_time || "-"))}
                    <small>${historyCount ? `${historyCount} message${historyCount === 1 ? "" : "s"}` : "No history"}</small>
                </div>
                <div class="contact-action">
                    <button type="button" class="edit-contact" data-contact-id="${id}">Edit</button>
                    <button type="button" class="open-chat" data-wa-id="${escapeHtml(waId)}">Chat</button>
                    <button type="button" class="delete-contact" data-contact-id="${id}">Delete</button>
                </div>
            </div>`;
    }).join("");

    container.querySelectorAll(".contact-checkbox").forEach(input => input.addEventListener("change", event => {
        const id = Number(event.currentTarget.dataset.contactId);
        if (event.currentTarget.checked) selectedContactIds.add(id); else selectedContactIds.delete(id);
        updateSelectionUi(getVisibleContacts());
    }));
    container.querySelectorAll(".edit-contact").forEach(button =>
        button.addEventListener("click", () => openContactEditor(Number(button.dataset.contactId))));
    container.querySelectorAll(".open-chat").forEach(button => button.addEventListener("click", () => {
        const waId = button.dataset.waId;
        if (waId) window.location.href = "inbox.html?wa_id=" + encodeURIComponent(waId);
    }));
    container.querySelectorAll(".delete-contact").forEach(button =>
        button.addEventListener("click", () => openDeleteChoice([Number(button.dataset.contactId)])));
    container.querySelectorAll(".dnd-toggle").forEach(button =>
        button.addEventListener("click", () => toggleMarketingDnd(
            Number(button.dataset.contactId), button.dataset.enable === "1"
        )));
    updateSelectionUi(contacts);
}

function updateSelectionUi(visibleContacts) {
    const bar = document.getElementById("bulkContactBar");
    const count = selectedContactIds.size;
    document.getElementById("selectedContactCount").textContent = String(count);
    bar.classList.toggle("hidden", count === 0);
    const visibleIds = visibleContacts.map(contact => Number(contact.id));
    const selectedVisible = visibleIds.filter(id => selectedContactIds.has(id)).length;
    const selectAll = document.getElementById("selectAllContacts");
    selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
}

function setAllVisibleContacts(checked) {
    getVisibleContacts().forEach(contact => {
        const id = Number(contact.id);
        if (checked) selectedContactIds.add(id); else selectedContactIds.delete(id);
    });
    applyContactFilter();
}

function setDndReasonVisibility() {
    document.getElementById("contactEditorDndReasonWrap")?.classList.toggle(
        "hidden", !document.getElementById("contactEditorDnd")?.checked
    );
}

function openAddContact() {
    contactEditorMode = "create";
    document.getElementById("contactEditorForm").reset();
    document.getElementById("contactEditorId").value = "";
    document.getElementById("contactEditorTitle").textContent = "Add Contact";
    document.getElementById("saveContactEditorButton").textContent = "Add Contact";
    setDndReasonVisibility();
    showEditor();
    document.getElementById("contactEditorName").focus();
}

function openContactEditor(contactId) {
    const contact = allContacts.find(item => Number(item.id) === Number(contactId));
    if (!contact) return;
    contactEditorMode = "edit";
    document.getElementById("contactEditorId").value = String(contact.id);
    document.getElementById("contactEditorName").value = contact.name || contact.profile_name || "";
    document.getElementById("contactEditorPhone").value = contact.wa_id || contact.phone_number || "";
    document.getElementById("contactEditorEmail").value = contact.email || "";
    document.getElementById("contactEditorCity").value = contact.city || "";
    document.getElementById("contactEditorProject").value = contact.project_name || "";
    document.getElementById("contactEditorDnd").checked = Number(contact.marketing_dnd || 0) === 1;
    document.getElementById("contactEditorDndReason").value = contact.marketing_dnd_reason || "";
    document.getElementById("contactEditorTitle").textContent = "Edit Contact";
    document.getElementById("saveContactEditorButton").textContent = "Save Contact";
    setDndReasonVisibility();
    showEditor();
    document.getElementById("contactEditorName").focus();
}

function showEditor() {
    document.getElementById("contactEditorModal").classList.remove("hidden");
    document.body.classList.add("contact-editor-open");
}

function closeContactEditor() {
    document.getElementById("contactEditorModal")?.classList.add("hidden");
    if (document.getElementById("contactDeleteModal")?.classList.contains("hidden")) {
        document.body.classList.remove("contact-editor-open");
    }
}

async function saveContactEditor(event) {
    event.preventDefault();
    const contactId = Number(document.getElementById("contactEditorId")?.value);
    const phoneNumber = String(document.getElementById("contactEditorPhone")?.value || "").replace(/[^0-9]/g, "");
    const saveButton = document.getElementById("saveContactEditorButton");
    if (!/^\d{7,15}$/.test(phoneNumber)) {
        await showContactAlert("WhatsApp number must contain 7 to 15 digits.", {
            title: "Invalid WhatsApp number", type: "danger"
        });
        document.getElementById("contactEditorPhone")?.focus();
        return;
    }
    saveButton.disabled = true;
    saveButton.textContent = contactEditorMode === "create" ? "Adding..." : "Saving...";
    try {
        await apiRequest(contactEditorMode === "create" ? "/inbox/contacts" : "/inbox/contacts/" + contactId, {
            method: contactEditorMode === "create" ? "POST" : "PUT",
            body: JSON.stringify({
                name: document.getElementById("contactEditorName")?.value.trim() || "",
                phone_number: phoneNumber,
                email: document.getElementById("contactEditorEmail")?.value.trim() || "",
                city: document.getElementById("contactEditorCity")?.value.trim() || "",
                project_name: document.getElementById("contactEditorProject")?.value.trim() || "",
                marketing_dnd: Boolean(document.getElementById("contactEditorDnd")?.checked),
                marketing_dnd_reason: document.getElementById("contactEditorDndReason")?.value.trim() || ""
            })
        });
        const successMessage = contactEditorMode === "create" ? "Contact added successfully." : "Contact updated successfully.";
        closeContactEditor();
        await loadContacts();
        if (typeof window.vboToast === "function") window.vboToast(successMessage, "success");
    } catch (error) {
        await showContactAlert(error.message || "Unable to save contact.", {
            title: "Contact save failed", type: "danger"
        });
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = contactEditorMode === "create" ? "Add Contact" : "Save Contact";
    }
}

async function toggleMarketingDnd(contactId, enabled) {
    const contact = allContacts.find(item => Number(item.id) === contactId);
    try {
        await apiRequest(`/inbox/contacts/${contactId}/marketing-dnd`, {
            method: "PUT",
            body: JSON.stringify({enabled, source: "manual", reason: enabled ? "Set manually from Contacts" : ""})
        });
        if (contact) {
            contact.marketing_dnd = enabled ? 1 : 0;
            contact.marketing_dnd_source = "manual";
            contact.marketing_dnd_reason = enabled ? "Set manually from Contacts" : "";
        }
        applyContactFilter();
        if (typeof window.vboToast === "function") {
            window.vboToast(enabled ? "Marketing DND enabled." : "Marketing messages allowed.", "success");
        }
    } catch (error) {
        await showContactAlert(error.message || "Unable to update DND.", {title: "DND update failed", type: "danger"});
    }
}

function openDeleteChoice(ids) {
    pendingDeleteIds = [...new Set(ids.map(Number).filter(Boolean))];
    if (!pendingDeleteIds.length) return;
    const selected = allContacts.filter(contact => pendingDeleteIds.includes(Number(contact.id)));
    const withHistory = selected.filter(contact => Number(contact.message_count || 0) > 0).length;
    document.getElementById("contactDeleteSummary").textContent =
        `${selected.length} contact${selected.length === 1 ? "" : "s"} selected; ${withHistory} ${withHistory === 1 ? "has" : "have"} message history.`;
    document.getElementById("contactDeleteModal").classList.remove("hidden");
    document.body.classList.add("contact-editor-open");
}

function closeDeleteChoice() {
    pendingDeleteIds = [];
    document.getElementById("contactDeleteModal")?.classList.add("hidden");
    if (document.getElementById("contactEditorModal")?.classList.contains("hidden")) {
        document.body.classList.remove("contact-editor-open");
    }
}

async function executeDelete(deleteHistory) {
    if (!pendingDeleteIds.length) return;
    const ids = [...pendingDeleteIds];
    const buttons = document.querySelectorAll("#contactDeleteModal button");
    buttons.forEach(button => button.disabled = true);
    try {
        const result = await apiRequest("/inbox/contacts/delete", {
            method: "POST", body: JSON.stringify({contact_ids: ids, delete_history: deleteHistory})
        });
        closeDeleteChoice();
        ids.forEach(id => selectedContactIds.delete(id));
        await loadContacts();
        let message = `${result.deleted} contact${result.deleted === 1 ? "" : "s"} deleted.`;
        if (result.protected) message += ` ${result.protected} with message history protected.`;
        if (deleteHistory && result.message_history_deleted) message += ` ${result.message_history_deleted} messages permanently deleted.`;
        await showContactAlert(message, {
            title: result.protected ? "Safe delete completed" : "Contacts deleted",
            type: result.protected ? "warning" : "success"
        });
    } catch (error) {
        await showContactAlert(error.message || "Unable to delete contacts.", {title: "Delete failed", type: "danger"});
    } finally {
        buttons.forEach(button => button.disabled = false);
    }
}

document.getElementById("contactEditorForm")?.addEventListener("submit", saveContactEditor);
document.getElementById("addContactButton")?.addEventListener("click", openAddContact);
document.getElementById("closeContactEditorButton")?.addEventListener("click", closeContactEditor);
document.getElementById("cancelContactEditorButton")?.addEventListener("click", closeContactEditor);
document.getElementById("contactEditorDnd")?.addEventListener("change", setDndReasonVisibility);
document.getElementById("contactEditorModal")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeContactEditor();
});
document.getElementById("selectAllContacts")?.addEventListener("change", event => setAllVisibleContacts(event.currentTarget.checked));
document.getElementById("clearContactSelection")?.addEventListener("click", () => {
    selectedContactIds.clear(); applyContactFilter();
});
document.getElementById("bulkDeleteContacts")?.addEventListener("click", () => openDeleteChoice([...selectedContactIds]));
document.getElementById("safeDeleteContacts")?.addEventListener("click", () => executeDelete(false));
document.getElementById("permanentDeleteContacts")?.addEventListener("click", () => executeDelete(true));
document.getElementById("closeContactDeleteButton")?.addEventListener("click", closeDeleteChoice);
document.getElementById("cancelContactDeleteButton")?.addEventListener("click", closeDeleteChoice);
document.getElementById("contactDeleteModal")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeDeleteChoice();
});
document.getElementById("searchInput")?.addEventListener("input", applyContactFilter);
document.getElementById("dndFilter")?.addEventListener("change", applyContactFilter);
document.addEventListener("keydown", event => {
    if (document.getElementById("vboDialogRoot")?.classList.contains("show")) return;
    if (event.key !== "Escape") return;
    if (!document.getElementById("contactDeleteModal")?.classList.contains("hidden")) closeDeleteChoice();
    else if (!document.getElementById("contactEditorModal")?.classList.contains("hidden")) closeContactEditor();
});
document.getElementById("logoutButton")?.addEventListener("click", () => {
    localStorage.removeItem("vbonotif_token");
    localStorage.removeItem("vbonotif_client");
    window.location.href = "index.html";
});

loadClientName();
loadContacts();
