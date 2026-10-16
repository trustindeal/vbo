const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

let contacts = [];
let selectedWaId = null;
let inboxTemplates = null;
let loadedMessages = [];
let messageNextOffset = 0;
let messageHasMore = false;
let messageLoadInProgress = false;
let chatRequestVersion = 0;
let messageLoadingTimer = null;
let showingArchived = false;
let showingBlocked = false;

const archiveIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" focusable="false"><path d="m480-240 160-160-56-56-64 64v-168h-80v168l-64-64-56 56 160 160ZM200-640v440h560v-440H200Zm0 520q-33 0-56.5-23.5T120-200v-499q0-14 4.5-27t13.5-24l50-61q11-14 27.5-21.5T250-840h460q18 0 34.5 7.5T772-811l50 61q9 11 13.5 24t4.5 27v499q0 33-23.5 56.5T760-120H200Zm16-600h528l-34-40H250l-34 40Zm264 300Z"/></svg>';
const blockedIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" focusable="false"><path d="m840-234-80-80v-446q0-17 11.5-28.5T800-800q17 0 28.5 11.5T840-760v526ZM360-714l-80-80v-6q0-17 11.5-28.5T320-840q17 0 28.5 11.5T360-800v86Zm160 160-80-80v-246q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v326Zm160 81h-80v-367q0-17 11.5-28.5T640-880q17 0 28.5 11.5T680-840v367Zm37 343L360-487v224L212-367l157 229q5 8 14 13t19 5h278q10 0 19.5-2.5T717-130ZM402-40q-30 0-56-13.5T303-92L48-465l24-23q19-19 45-22t47 12l116 81v-150L27-820l57-57L876-85l-57 57-44-44q-20 15-44 23.5T680-40H402Zm137-268Zm61-165Z"/></svg>';

async function loadInboxTemplates() {
    if (inboxTemplates !== null) return;

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/templates",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            inboxTemplates = [];
            return;
        }

        const data = await response.json();
        inboxTemplates = data.templates || [];
    } catch (error) {
        console.error("INBOX TEMPLATE LOAD ERROR:", error);
        inboxTemplates = [];
    }
}

function updateArchiveViewButton() {
    const button = document.getElementById("inboxArchiveButton");
    const blockedButton = document.getElementById("inboxBlockedButton");
    const searchInput = document.getElementById("searchInput");
    const chatArchiveOption = document.getElementById("chatMenuHideOption");
    const chatBlockOption = document.getElementById("chatMenuBlockOption");
    const icon = document.getElementById("inboxArchiveIcon");
    const label = document.getElementById("inboxArchiveLabel");
    const blockedIcon = document.getElementById("inboxBlockedIcon");
    const blockedLabel = document.getElementById("inboxBlockedLabel");
    if (!button) return;

    button.classList.toggle("is-active", showingArchived);
    button.setAttribute("aria-pressed", String(showingArchived));
    button.setAttribute("aria-label", showingArchived ? "Show inbox conversations" : "Show archived conversations");
    button.title = showingArchived ? "Back to inbox" : "Archived conversations";
    if (icon) icon.innerHTML = showingArchived ? "&#8592;" : archiveIconSvg;
    if (label) label.textContent = showingArchived ? "Inbox" : "";
    if (blockedButton) {
        blockedButton.classList.toggle("is-active", showingBlocked);
        blockedButton.setAttribute("aria-pressed", String(showingBlocked));
        blockedButton.setAttribute("aria-label", showingBlocked ? "Show inbox conversations" : "Show blocked conversations");
        blockedButton.title = showingBlocked ? "Back to inbox" : "Blocked conversations";
    }
    if (blockedIcon) blockedIcon.innerHTML = showingBlocked ? "&#8592;" : blockedIconSvg;
    if (blockedLabel) blockedLabel.textContent = showingBlocked ? "Inbox" : "";
    if (searchInput) {
        searchInput.placeholder = showingBlocked ? "Search blocked conversations..." : (showingArchived ? "Search archived conversations..." : "Search conversations...");
    }
    if (chatArchiveOption) {
        chatArchiveOption.textContent = showingArchived ? "Restore conversation" : "Archive conversation";
        chatArchiveOption.hidden = showingBlocked;
    }
    if (chatBlockOption) {
        chatBlockOption.textContent = showingBlocked ? "Unblock conversation" : "Block conversation";
        chatBlockOption.hidden = showingArchived;
    }
}

async function loadContacts() {
    const list = document.getElementById("contactList");
    updateArchiveViewButton();

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/contacts?archived=" + (showingArchived ? "true" : "false") + "&blocked=" + (showingBlocked ? "true" : "false"),
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to load contacts");
        }

        contacts = data.contacts || [];
        renderContacts(contacts);

        const requestedWaId =
            new URLSearchParams(window.location.search).get("wa_id");

        if (requestedWaId && !showingArchived && !showingBlocked) {
            setTimeout(() => {
                openChat(requestedWaId);
            }, 100);
        }

    } catch (error) {
        list.innerHTML =
            '<div class="loading">Unable to load ' + (showingBlocked ? "blocked" : (showingArchived ? "archived" : "inbox")) + ' conversations.</div>';
        console.error(error);
    }
}

function renderContacts(items) {
    const list = document.getElementById("contactList");

    if (!items.length) {
        list.innerHTML =
            '<div class="loading">' + (showingBlocked ? "No blocked conversations." : (showingArchived ? "No archived conversations." : "No conversations yet.")) + '</div>';
        return;
    }

    list.innerHTML = items.map(contact => {
        const name =
            contact.profile_name ||
            contact.name ||
            contact.phone_number ||
            contact.wa_id;

        const initial = name.charAt(0).toUpperCase();

        return `
            <div class="contact ${selectedWaId === contact.wa_id ? "selected" : ""}"
                 data-wa-id="${contact.wa_id}">
                <div class="contact-avatar">${initial}</div>
                <div class="contact-info">
                    <div class="contact-top">
                        <span class="contact-name">${escapeHtml(name)}</span>
                        <span class="contact-time">
                            ${formatTime(contact.last_message_time)}
                        </span>
                    </div>
                    <div class="contact-unread">
                        ${Number(contact.unread_count || 0) > 0 ? `<span class="unread-badge">${Number(contact.unread_count)}</span>` : ""}
                    </div>
                    <div class="contact-last">
                        ${escapeHtml(contact.last_message || "No messages")}
                    </div>
                    <button type="button" class="contact-menu-btn" data-contact-menu-id="${contact.wa_id}" title="Menu" aria-label="Chat menu">&#8942;</button>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".contact").forEach(item => {
        item.addEventListener("click", event => {
            if (event.target.closest(".contact-menu-btn, .contact-menu-dropdown")) return;
            openChat(item.dataset.waId);
        });
    });
}

function showMessageLoading(label) {
    const loader = document.getElementById("inboxMessageLoading");
    const labelEl = document.getElementById("inboxMessageLoadingLabel");
    const timeEl = document.getElementById("inboxMessageLoadingTime");
    if (!loader || !labelEl || !timeEl) return;

    const startedAt = Date.now();
    labelEl.textContent = label || "Loading messages";
    timeEl.textContent = "0s";
    loader.hidden = false;
    if (messageLoadingTimer) clearInterval(messageLoadingTimer);
    messageLoadingTimer = setInterval(function () {
        timeEl.textContent = Math.floor((Date.now() - startedAt) / 1000) + "s";
    }, 250);
}

function hideMessageLoading() {
    const loader = document.getElementById("inboxMessageLoading");
    if (loader) loader.hidden = true;
    if (messageLoadingTimer) {
        clearInterval(messageLoadingTimer);
        messageLoadingTimer = null;
    }
}

async function openChat(waId) {
    selectedWaId = waId;
    const requestVersion = ++chatRequestVersion;
    loadedMessages = [];
    messageNextOffset = 0;
    messageHasMore = false;

    renderContacts(
        contacts.filter(contact =>
            true
        )
    );

    const empty = document.getElementById("emptyChat");
    const chat = document.getElementById("chatView");

    empty.classList.add("hidden");
    document.querySelector(".inbox").classList.add("mobile-chat-open");
    chat.classList.remove("hidden");
    document.querySelector(".inbox").classList.add("mobile-chat-open");

    document.getElementById("messages").innerHTML = "";
    showMessageLoading("Loading latest 5 messages");

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/messages/" +
            encodeURIComponent(waId) + "?limit=5&offset=0",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to load conversation");
        }

        if (requestVersion !== chatRequestVersion || selectedWaId !== waId) return;

        const contact = data.contact;

        document.getElementById("chatName").textContent =
            contact.profile_name ||
            contact.name ||
            contact.phone_number;

        document.getElementById("chatNumber").textContent =
            contact.phone_number || contact.wa_id;

        document.getElementById("chatAvatar").textContent =
            (
                contact.profile_name ||
                contact.name ||
                contact.phone_number ||
                "?"
            ).charAt(0).toUpperCase();

        loadedMessages = data.messages || [];
        messageNextOffset = Number(data.next_offset || loadedMessages.length);
        messageHasMore = data.has_more === true;
        await renderMessages(loadedMessages, true);

        document.getElementById("messageInput").focus();

    } catch (error) {
        console.error(error);
        if (requestVersion === chatRequestVersion) {
            document.getElementById("messages").innerHTML =
                '<div class="loading">Unable to load messages. Please try again.</div>';
        }
    } finally {
        if (requestVersion === chatRequestVersion) hideMessageLoading();
    }
}

async function loadOlderMessages() {
    if (!selectedWaId || !messageHasMore || messageLoadInProgress) return;

    const waId = selectedWaId;
    const requestVersion = chatRequestVersion;
    const container = document.getElementById("messages");
    const previousScrollHeight = container ? container.scrollHeight : 0;
    const previousScrollTop = container ? container.scrollTop : 0;
    const loadMoreButton = document.getElementById("loadOlderMessages");
    messageLoadInProgress = true;
    if (loadMoreButton) {
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = "Loading older messages...";
    }
    showMessageLoading("Loading 10 older messages");

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/messages/" +
            encodeURIComponent(waId) + "?limit=10&offset=" + encodeURIComponent(messageNextOffset),
            { headers: { "Authorization": "Bearer " + token } }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load older messages");
        if (requestVersion !== chatRequestVersion || selectedWaId !== waId) return;

        loadedMessages = (data.messages || []).concat(loadedMessages);
        messageNextOffset = Number(data.next_offset || messageNextOffset + (data.messages || []).length);
        messageHasMore = data.has_more === true;
        await renderMessages(loadedMessages, false);
        if (container) {
            container.scrollTop = container.scrollHeight - previousScrollHeight + previousScrollTop;
        }
    } catch (error) {
        alert(error.message || "Unable to load older messages.");
    } finally {
        messageLoadInProgress = false;
        if (requestVersion === chatRequestVersion) hideMessageLoading();
    }
}

async function buildInboxAttachmentHtml(message) {
    if (!message.media_url) return "";

    const mediaPath = String(message.media_url);
    if (!/^\/api\/v1\/whatsapp\/inbox\/media\/\d+$/.test(mediaPath)) {
        return '<div class="inbox-attachment-error">Attachment unavailable</div>';
    }

    try {
        const response = await fetch("https://app.vbo.co.in" + mediaPath, {
            headers: { "Authorization": "Bearer " + token },
            cache: "no-store"
        });

        if (!response.ok) throw new Error("Attachment request failed");

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (!Array.isArray(window.__inboxMediaObjectUrls)) {
            window.__inboxMediaObjectUrls = [];
        }
        window.__inboxMediaObjectUrls.push(objectUrl);

        const mime = String(message.media_mime_type || blob.type || "").toLowerCase();
        const filename = escapeHtml(String(message.media_filename || "Attachment"));

        if (mime.startsWith("image/")) {
            return `<div class="inbox-attachment"><img class="inbox-media-image" src="${objectUrl}" alt="WhatsApp image" loading="lazy" data-inbox-download-name="${filename}"></div>`;
        }

        if (mime.startsWith("audio/")) {
            return `<div class="inbox-attachment"><audio controls preload="none" src="${objectUrl}"></audio></div>`;
        }

        if (mime.startsWith("video/")) {
            return `<div class="inbox-attachment"><video controls preload="metadata" class="inbox-media-video" src="${objectUrl}" data-inbox-download-name="${filename}"></video></div>`;
        }

        return `<div class="inbox-attachment"><a href="${objectUrl}" download="${filename}" rel="noopener">&#128206; ${filename}</a></div>`;
    } catch (error) {
        console.error("Inbox attachment load failed:", error);
        return '<div class="inbox-attachment-error">Attachment unavailable</div>';
    }
}
async function renderMessages(messages, scrollToBottom) {
    const container = document.getElementById("messages");

    if (!messages.length) {
        container.innerHTML =
            '<div class="loading">No messages in this conversation.</div>';
        return;
    }

    if (Array.isArray(window.__inboxMediaObjectUrls)) {
        window.__inboxMediaObjectUrls.forEach(url => URL.revokeObjectURL(url));
        window.__inboxMediaObjectUrls = [];
    }

    await loadInboxTemplates();

    const attachmentHtmlById = new Map();
    await Promise.all(messages.filter(message => message.media_url).map(async message => {
        attachmentHtmlById.set(
            String(message.id),
            await buildInboxAttachmentHtml(message)
        );
    }));
    const loadMoreHtml = messageHasMore
        ? '<div class="inbox-load-more"><button type="button" id="loadOlderMessages">Load 10 older messages</button></div>'
        : "";

    container.innerHTML = loadMoreHtml + messages.map(message => {
        const rawText = String(message.message_text || "");
        const templateMatch = rawText.match(/\[Template:\s*([^\]]+)\]/i);

        let messageHtml = "";
        let templateLabel = "";
        const attachmentHtml = attachmentHtmlById.get(String(message.id)) || "";

        if (templateMatch) {
            const templateName = templateMatch[1].trim();
            templateLabel = templateName;

            const template = (inboxTemplates || []).find(
                item =>
                    String(item.template_name || "").toLowerCase() ===
                    templateName.toLowerCase()
            );

            let bodyText = rawText
                .replace(templateMatch[0], "")
                .trim();

            if (template && template.body_text) {
                bodyText = template.body_text;
            }

            if (bodyText) {
                messageHtml += `
                    <div class="template-body">
                        ${escapeHtml(bodyText).replace(/\n/g, "<br>")}
                    </div>
                `;
            }
            let templateButtons = [];

            if (template) {
                try {
                    templateButtons = JSON.parse(template.button_list || "[]");
                } catch (e) {
                    templateButtons = [];
                }

                if (!Array.isArray(templateButtons)) {
                    templateButtons = [];
                }

                if (!templateButtons.length && template.button_text) {
                    templateButtons = [{
                        type: template.button_type || "",
                        text: template.button_text || "",
                        url: template.button_url || ""
                    }];
                }
            }

            templateButtons.forEach(button => {
                const buttonText = String(button.text || "").trim();

                if (!buttonText) {
                    return;
                }

                const buttonUrl = String(button.url || "").trim();
                const safeButtonUrl = /^https?:\/\//i.test(buttonUrl)
                    ? buttonUrl
                    : "";

                if (safeButtonUrl) {
                    messageHtml += `
                        <a
                            class="template-button template-button-link"
                            href="${escapeHtml(safeButtonUrl)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <span class="template-button-icon">&#8599;</span>
                            <span>${escapeHtml(buttonText)}</span>
                        </a>
                    `;
                } else {
                    messageHtml += `
                        <div class="template-button">
                            <span>${escapeHtml(buttonText)}</span>
                        </div>
                    `;
                }
            });
            if (template && template.footer_text) {
                messageHtml += `
                    <div class="template-footer">
                        ${escapeHtml(template.footer_text)}
                    </div>
                `;
            }
        } else {
            messageHtml = attachmentHtml ? escapeHtml(rawText || "") : escapeHtml(rawText || "[No text message]");
        }

        return `
            <div class="message-row ${message.direction}" data-message-id="${message.id}">
                <div class="message-select-wrap">
                    <input type="checkbox" class="message-select-checkbox" data-message-checkbox="${message.id}" tabindex="-1">
                </div>
                <div class="message-bubble">
                    ${attachmentHtml}${messageHtml}
                    <div class="message-meta">
                        <span class="template-label">
                            ${templateLabel ? "Template: " + escapeHtml(templateLabel) : ""}
                        </span>
                        <span class="message-time">
                            ${formatDateTime(message.created_at)}
                            ${message.direction === "outgoing" && message.status
                                ? getMessageTicks(message.status)
                                : ""}
                        </span>
                    </div>
                    <button type="button" class="message-menu-btn" data-message-menu-id="${message.id}" title="Menu" aria-label="Message menu">&#8942;</button>
                </div>
            </div>
        `;
    }).join("");

    if (scrollToBottom) container.scrollTop = container.scrollHeight;
}



/* ============= Inbox message delete / hide / undo ============= */

let bulkSelectMode = false;
let bulkSelectedIds = new Set();
let undoToastTimer = null;
let undoRestorePayload = null;

function setBulkSelectMode(enabled) {
    bulkSelectMode = !!enabled;
    bulkSelectedIds.clear();
    const container = document.getElementById("messages");
    if (container) {
        container.classList.toggle("bulk-select-mode", bulkSelectMode);
    }
    const bar = document.getElementById("bulkActionBar");
    if (bar) bar.hidden = !bulkSelectMode;
    updateBulkCount();
}

function updateBulkCount() {
    const countEl = document.getElementById("bulkCount");
    if (countEl) countEl.textContent = bulkSelectedIds.size + " selected";
    const delBtn = document.getElementById("bulkDelete");
    if (delBtn) delBtn.disabled = bulkSelectedIds.size === 0;
}

function toggleBulkSelect(messageId, checked) {
    const idNum = String(messageId);
    if (checked) bulkSelectedIds.add(idNum);
    else bulkSelectedIds.delete(idNum);
    const row = document.querySelector('[data-message-id="' + idNum + '"]');
    if (row) row.classList.toggle("is-selected", checked);
    updateBulkCount();
}

function hideMessageRow(messageId) {
    const row = document.querySelector('[data-message-id="' + messageId + '"]');
    if (row) row.remove();
}


function showToast(text, actionLabel, actionHandler) {
    const toast = document.getElementById("inboxToast");
    const msgEl = document.getElementById("inboxToastMessage");
    const actionEl = document.getElementById("inboxToastAction");
    if (!toast || !msgEl || !actionEl) return;
    msgEl.textContent = text || "";
    if (actionLabel && typeof actionHandler === "function") {
        actionEl.hidden = false;
        actionEl.textContent = actionLabel;
        actionEl.onclick = function () {
            hideToast();
            actionHandler();
        };
    } else {
        actionEl.hidden = true;
        actionEl.onclick = null;
    }
    toast.hidden = false;
    if (undoToastTimer) clearTimeout(undoToastTimer);
    undoToastTimer = setTimeout(hideToast, 8000);
}

function hideToast() {
    const toast = document.getElementById("inboxToast");
    if (toast) toast.hidden = true;
    if (undoToastTimer) { clearTimeout(undoToastTimer); undoToastTimer = null; }
}

async function confirmInboxAction(message, options) {
    if (window.VBOUI && typeof window.VBOUI.confirm === "function") {
        return window.VBOUI.confirm(message, options);
    }
    return window.confirm(message);
}

async function apiDeleteMessages(waId, messageIds) {
    const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/inbox/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ wa_id: waId, message_ids: messageIds })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.detail || "Delete failed");
    return result;
}

async function apiRestoreMessages(waId, messageIds) {
    const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/inbox/messages/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ wa_id: waId, message_ids: messageIds })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.detail || "Restore failed");
    return result;
}

async function apiHideContact(waId) {
    const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/inbox/contacts/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ wa_id: waId })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.detail || "Hide failed");
    return result;
}

async function apiRestoreContact(waId) {
    const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/inbox/contacts/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ wa_id: waId })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.detail || "Restore failed");
    return result;
}

async function apiBlockContact(waId) {
    const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/inbox/contacts/block", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ wa_id: waId })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.detail || "Block failed");
    return result;
}

async function apiUnblockContact(waId) {
    const response = await fetch("https://app.vbo.co.in/api/v1/whatsapp/inbox/contacts/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ wa_id: waId })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.detail || "Unblock failed");
    return result;
}

async function deleteSingleMessage(waId, messageId) {
    const confirmed = await confirmInboxAction(
        "Delete this message? You can restore it immediately using Undo.",
        { title: "Delete message", confirmText: "Delete", type: "danger" }
    );
    if (!confirmed) return;

    const row = document.querySelector('[data-message-id="' + messageId + '"]');
    try {
        await apiDeleteMessages(waId, [messageId]);
        loadedMessages = loadedMessages.filter(function (message) {
            return String(message.id) !== String(messageId);
        });
        if (row) row.remove();
        showToast("Message deleted. Restore it with Undo.", "Undo", async function () {
            try {
                await apiRestoreMessages(waId, [messageId]);
                await openChat(waId);
            } catch (e) {
                alert(e.message || "Undo failed");
            }
        });
    } catch (e) {
        alert(e.message || "Delete failed");
    }
}

async function deleteBulkSelected() {
    if (!selectedWaId || !bulkSelectedIds.size) return;
    const ids = Array.from(bulkSelectedIds);
    const confirmed = await confirmInboxAction(
        "Delete " + ids.length + " selected message" + (ids.length === 1 ? "?" : "s?") + " You can restore them immediately using Undo.",
        { title: "Delete selected messages", confirmText: "Delete", type: "danger" }
    );
    if (!confirmed) return;

    try {
        await apiDeleteMessages(selectedWaId, ids);
        const waId = selectedWaId;
        const deletedIds = new Set(ids.map(String));
        loadedMessages = loadedMessages.filter(function (message) {
            return !deletedIds.has(String(message.id));
        });
        ids.forEach(function (id) { hideMessageRow(id); });
        setBulkSelectMode(false);
        showToast(ids.length + " message" + (ids.length === 1 ? " deleted." : "s deleted.") + " Restore with Undo.", "Undo", async function () {
            try {
                await apiRestoreMessages(waId, ids);
                await openChat(waId);
            } catch (e) {
                alert(e.message || "Undo failed");
            }
        });
    } catch (e) {
        alert(e.message || "Delete failed");
    }
}

async function hideContactConversation(waId) {
    if (!waId) return;
    const confirmed = await confirmInboxAction(
        "Hide this conversation from the inbox? It will appear again when the contact sends a new WhatsApp message.",
        { title: "Hide conversation", confirmText: "Hide", type: "danger" }
    );
    if (!confirmed) return;

    try {
        await apiHideContact(waId);
        if (selectedWaId === waId) {
            selectedWaId = null;
            document.getElementById("chatView").classList.add("hidden");
            document.getElementById("emptyChat").classList.remove("hidden");
        }
        await loadContacts();
        showToast("Conversation hidden. New messages will show it again.");
    } catch (e) {
        alert(e.message || "Unable to hide conversation");
    }
}

async function restoreContactConversation(waId) {
    if (!waId) return;
    try {
        await apiRestoreContact(waId);
        if (selectedWaId === waId) {
            selectedWaId = null;
            document.getElementById("chatView").classList.add("hidden");
            document.getElementById("emptyChat").classList.remove("hidden");
        }
        await loadContacts();
        showToast("Conversation restored to inbox.");
    } catch (e) {
        alert(e.message || "Unable to restore conversation");
    }
}

async function blockContactConversation(waId) {
    if (!waId) return;
    const confirmed = await confirmInboxAction(
        "Block this conversation from the inbox? New WhatsApp messages will remain blocked until you unblock it.",
        { title: "Block conversation", confirmText: "Block", type: "danger" }
    );
    if (!confirmed) return;
    try {
        await apiBlockContact(waId);
        if (selectedWaId === waId) {
            selectedWaId = null;
            document.getElementById("chatView").classList.add("hidden");
            document.getElementById("emptyChat").classList.remove("hidden");
        }
        await loadContacts();
        showToast("Conversation blocked. New messages will stay blocked.");
    } catch (e) {
        alert(e.message || "Unable to block conversation");
    }
}

async function unblockContactConversation(waId) {
    if (!waId) return;
    try {
        await apiUnblockContact(waId);
        if (selectedWaId === waId) {
            selectedWaId = null;
            document.getElementById("chatView").classList.add("hidden");
            document.getElementById("emptyChat").classList.remove("hidden");
        }
        await loadContacts();
        showToast("Conversation unblocked and returned to inbox.");
    } catch (e) {
        alert(e.message || "Unable to unblock conversation");
    }
}

let messageMenuEl = null;

function openMessageMenu(anchorEl, messageId) {
    closeMessageMenu();
    const row = anchorEl.closest("[data-message-id]");
    if (!row) return;
    const menu = document.createElement("div");
    menu.className = "message-menu-dropdown";
    const hasAttachment = !!row.querySelector(".inbox-media-image, .inbox-media-video, .inbox-attachment a, audio");
    let html = "";
    if (hasAttachment) {
        html += '<button type="button" class="message-menu-item" data-message-menu-action="download" data-message-menu-for="' + messageId + '">Download</button>';
    }
    html += '<button type="button" class="message-menu-item" data-message-menu-action="select" data-message-menu-for="' + messageId + '">Select message</button>';
    html += '<button type="button" class="message-menu-item message-menu-item-danger" data-message-menu-action="delete" data-message-menu-for="' + messageId + '">Delete message</button>';
    menu.innerHTML = html;
    row.appendChild(menu);
    messageMenuEl = menu;
    const closeOnOutside = function (e) {
        if (messageMenuEl && !messageMenuEl.contains(e.target) && !e.target.closest("[data-message-menu-id]")) {
            closeMessageMenu();
        }
    };
    setTimeout(function () {
        document.addEventListener("click", closeOnOutside);
    }, 0);
    messageMenuEl._close = function () {
        document.removeEventListener("click", closeOnOutside);
    };
}

function closeMessageMenu() {
    if (!messageMenuEl) return;
    if (messageMenuEl._close) messageMenuEl._close();
    messageMenuEl.remove();
    messageMenuEl = null;
}

let contactMenuEl = null;

function openContactMenu(anchorEl, waId) {
    closeContactMenu();
    const menu = document.createElement("div");
    menu.className = "contact-menu-dropdown";
    menu.innerHTML = showingBlocked
        ? '<button type="button" class="contact-menu-item" data-contact-menu-action="unblock" data-contact-menu-for="' + waId + '">Unblock conversation</button>'
        : showingArchived
        ? '<button type="button" class="contact-menu-item" data-contact-menu-action="restore" data-contact-menu-for="' + waId + '">Restore conversation</button>'
        : '<button type="button" class="contact-menu-item" data-contact-menu-action="select" data-contact-menu-for="' + waId + '">Select messages</button>' +
          '<button type="button" class="contact-menu-item contact-menu-item-danger" data-contact-menu-action="hide" data-contact-menu-for="' + waId + '">Archive conversation</button>' +
          '<button type="button" class="contact-menu-item contact-menu-item-danger" data-contact-menu-action="block" data-contact-menu-for="' + waId + '">Block conversation</button>';
    menu.style.visibility = "hidden";
    document.body.appendChild(menu);
    const anchorRect = anchorEl.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, anchorRect.right - menuWidth));
    const top = anchorRect.top >= menuHeight + 8
        ? anchorRect.top - menuHeight - 4
        : Math.min(window.innerHeight - menuHeight - 8, anchorRect.bottom + 4);
    menu.style.left = left + "px";
    menu.style.top = top + "px";
    menu.style.visibility = "visible";
    contactMenuEl = menu;
    const closeOnOutside = function (e) {
        if (contactMenuEl && !contactMenuEl.contains(e.target) && !e.target.closest("[data-contact-menu-id]")) {
            closeContactMenu();
        }
    };
    setTimeout(function () {
        document.addEventListener("click", closeOnOutside);
    }, 0);
    menu._close = function () {
        document.removeEventListener("click", closeOnOutside);
    };
}

function closeContactMenu() {
    if (!contactMenuEl) return;
    if (contactMenuEl._close) contactMenuEl._close();
    contactMenuEl.remove();
    contactMenuEl = null;
}

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const button = document.getElementById("sendButton");

    const message = input.value.trim();

    if (!selectedWaId) {
        alert("Please select a conversation first.");
        return;
    }

    if (!message) {
        return;
    }

    button.disabled = true;

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/send",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    wa_id: selectedWaId,
                    message: message
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Message could not be sent");
        }

        input.value = "";

        await openChat(selectedWaId);

        console.log("MESSAGE SENT:", data);

    } catch (error) {
        console.error(error);
        alert(error.message || "Unable to send message.");
    } finally {
        button.disabled = false;
        input.focus();
    }
}


async function sendInboxAttachment(pickerId = "attachmentInput") {
    const picker = document.getElementById(pickerId);
    const rawFiles = picker.files ? Array.from(picker.files) : [];
    if (!rawFiles.length) return;
    if (!selectedWaId) {
        alert("Please select a conversation first.");
        picker.value = "";
        return;
    }
    const files = [];
    for (const f of rawFiles) {
        const processed = await maybeCompressImage(f);
        if (processed.size > 16 * 1024 * 1024) {
            alert("Each attachment must be 16 MiB or less. " + processed.name + " is too big.");
            picker.value = "";
            return;
        }
        files.push(processed);
    }
    openAttachmentComposer(files);
}

async function maybeCompressImage(file) {
    const isImage = file.type && file.type.startsWith("image/");
    if (!isImage) return file;
    if (file.size <= 10 * 1024 * 1024) return file;
    if (file.type === "image/gif") return file;
    if (file.type === "image/heic" || file.type === "image/heif") return file;
    try {
        const img = await loadImageFromFile(file);
        const maxDim = 2048;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w <= 0 || h <= 0) return file;
        if (w > maxDim || h > maxDim) {
            const scale = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await new Promise(function (resolve) {
            canvas.toBlob(resolve, "image/jpeg", 0.75);
        });
        if (!blob) return file;
        if (blob.size >= file.size) return file;
        const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
        return new File([blob], baseName + ".jpg", { type: "image/jpeg" });
    } catch (e) {
        console.warn("Image compression failed, sending original:", e);
        return file;
    }
}

function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error("Image load failed"));
        };
        img.src = url;
    });
}

let pendingComposerFiles = [];

function openAttachmentComposer(files) {
    pendingComposerFiles = files.slice();
    renderAttachmentComposer();
    const modal = document.getElementById("inboxComposer");
    const captionEl = document.getElementById("inboxComposerCaption");
    if (!modal) return;
    if (captionEl) captionEl.value = "";
    modal.hidden = false;
    modal.dataset.filePending = "1";
    if (captionEl) captionEl.focus();
}

function renderAttachmentComposer() {
    const previewEl = document.getElementById("inboxComposerPreview");
    if (!previewEl) return;
    if (previewEl.dataset.objectUrls) {
        try {
            JSON.parse(previewEl.dataset.objectUrls).forEach(function (u) { URL.revokeObjectURL(u); });
        } catch (e) {}
        delete previewEl.dataset.objectUrls;
    }
    previewEl.innerHTML = "";
    previewEl.classList.toggle("is-multi", pendingComposerFiles.length > 1);
    const urls = [];
    pendingComposerFiles.forEach(function (f, index) {
        const wrap = document.createElement("div");
        wrap.className = "inbox-composer-item";
        if (f.type && f.type.startsWith("image/")) {
            const url = URL.createObjectURL(f);
            urls.push(url);
            const img = document.createElement("img");
            img.src = url;
            img.alt = f.name;
            wrap.appendChild(img);
        } else {
            const label = document.createElement("div");
            label.className = "inbox-composer-file";
            label.textContent = f.name + " (" + Math.ceil(f.size / 1024) + " KB)";
            wrap.appendChild(label);
        }
        if (f.type && f.type.startsWith("image/")) {
            const cropBtn = document.createElement("button");
            cropBtn.type = "button";
            cropBtn.className = "inbox-composer-crop";
            cropBtn.setAttribute("aria-label", "Crop");
            cropBtn.textContent = "Crop";
            cropBtn.dataset.cropIndex = String(index);
            wrap.appendChild(cropBtn);
        }
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "inbox-composer-remove";
        rm.setAttribute("aria-label", "Remove");
        rm.textContent = "X";
        rm.dataset.removeIndex = String(index);
        wrap.appendChild(rm);
        previewEl.appendChild(wrap);
    });
    previewEl.dataset.objectUrls = JSON.stringify(urls);
}

function removeComposerFile(index) {
    if (index < 0 || index >= pendingComposerFiles.length) return;
    pendingComposerFiles.splice(index, 1);
    if (!pendingComposerFiles.length) {
        closeAttachmentComposer();
        return;
    }
    renderAttachmentComposer();
}

let cropState = null;

function openCropOverlay(index) {
    const modal = document.getElementById("inboxCropper");
    const img = document.getElementById("inboxCropperImage");
    const stage = document.getElementById("inboxCropperStage");
    const sel = document.getElementById("inboxCropperSelection");
    if (!modal || !img || !stage || !sel) return;
    if (index < 0 || index >= pendingComposerFiles.length) return;
    const file = pendingComposerFiles[index];
    if (!file.type || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    cropState = { index: index, url: url, startX: 0, startY: 0, x: 0, y: 0, w: 0, h: 0, dragging: false, imgNaturalW: 0, imgNaturalH: 0 };
    img.onload = function () {
        cropState.imgNaturalW = img.naturalWidth;
        cropState.imgNaturalH = img.naturalHeight;
        const rect = img.getBoundingClientRect();
        const x0 = 10, y0 = 10, w0 = Math.max(20, rect.width - 20), h0 = Math.max(20, rect.height - 20);
        cropState.x = x0; cropState.y = y0; cropState.w = w0; cropState.h = h0;
        updateCropSelection();
    };
    img.src = url;
    modal.hidden = false;
}

function updateCropSelection() {
    const sel = document.getElementById("inboxCropperSelection");
    if (!sel || !cropState) return;
    const handles = ["nw","n","ne","e","se","s","sw","w"];
    const existing = sel.querySelectorAll("[data-crop-handle]");
    if (existing.length !== handles.length) {
        sel.innerHTML = "";
        handles.forEach(function (h) {
            const el = document.createElement("div");
            el.className = "inbox-cropper-handle";
            el.dataset.cropHandle = h;
            el.setAttribute("data-handle", h);
            sel.appendChild(el);
        });
    }
    sel.style.left = cropState.x + "px";
    sel.style.top = cropState.y + "px";
    sel.style.width = cropState.w + "px";
    sel.style.height = cropState.h + "px";
}

function closeCropOverlay() {
    const modal = document.getElementById("inboxCropper");
    const img = document.getElementById("inboxCropperImage");
    if (cropState && cropState.url) URL.revokeObjectURL(cropState.url);
    cropState = null;
    if (img) img.src = "";
    if (modal) modal.hidden = true;
}

function resetCropSelection() {
    const img = document.getElementById("inboxCropperImage");
    if (!img || !cropState) return;
    const rect = img.getBoundingClientRect();
    cropState.x = 10; cropState.y = 10;
    cropState.w = Math.max(20, rect.width - 20);
    cropState.h = Math.max(20, rect.height - 20);
    updateCropSelection();
}

function applyCrop() {
    const img = document.getElementById("inboxCropperImage");
    if (!img || !cropState || !cropState.imgNaturalW) { closeCropOverlay(); return; }
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || cropState.w <= 0 || cropState.h <= 0) { closeCropOverlay(); return; }
    const scaleX = cropState.imgNaturalW / rect.width;
    const scaleY = cropState.imgNaturalH / rect.height;
    const sx = Math.max(0, Math.round(cropState.x * scaleX));
    const sy = Math.max(0, Math.round(cropState.y * scaleY));
    const sw = Math.min(cropState.imgNaturalW - sx, Math.round(cropState.w * scaleX));
    const sh = Math.min(cropState.imgNaturalH - sy, Math.round(cropState.h * scaleY));
    if (sw <= 0 || sh <= 0) { closeCropOverlay(); return; }
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) { closeCropOverlay(); return; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const index = cropState.index;
    const origName = pendingComposerFiles[index].name;
    const baseName = origName.replace(/\.[^.]+$/, "") || "image";
    canvas.toBlob(function (blob) {
        if (!blob) { closeCropOverlay(); return; }
        const newFile = new File([blob], baseName + "_cropped.jpg", { type: "image/jpeg" });
        pendingComposerFiles[index] = newFile;
        closeCropOverlay();
        renderAttachmentComposer();
    }, "image/jpeg", 0.92);
}

function closeAttachmentComposer() {
    const modal = document.getElementById("inboxComposer");
    const previewEl = document.getElementById("inboxComposerPreview");
    if (!modal || !previewEl) return;
    if (previewEl.dataset.objectUrls) {
        try {
            JSON.parse(previewEl.dataset.objectUrls).forEach(function (u) { URL.revokeObjectURL(u); });
        } catch (e) {}
        delete previewEl.dataset.objectUrls;
    }
    previewEl.innerHTML = "";
    previewEl.classList.remove("is-multi");
    modal.hidden = true;
    delete modal.dataset.filePending;
    pendingComposerFiles = [];
    const picker = document.getElementById("attachmentInput");
    if (picker) picker.value = "";
    const cameraPicker = document.getElementById("cameraInput");
    if (cameraPicker) cameraPicker.value = "";
}

async function doSendInboxAttachment(files, caption) {
    const button = document.getElementById("attachmentButton");
    button.disabled = true;
    try {
        for (const file of files) {
            await uploadSingleAttachment(file, caption);
        }
        await openChat(selectedWaId);
    } finally {
        button.disabled = false;
    }
}

async function uploadSingleAttachment(file, caption) {
    const tokenValue = token;
    const form = new FormData();
    form.append("wa_id", selectedWaId);
    form.append("file", file);
    form.append("caption", caption || "");

    const messagesEl = document.getElementById("messages");
    const tempId = "uploading-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    if (messagesEl) {
        const tempRow = document.createElement("div");
        tempRow.className = "message-row outgoing";
        tempRow.id = tempId;
        tempRow.innerHTML = '<div class="message-bubble"><span class="message-uploading"><span class="message-uploading-spinner"></span>' + escapeHtml(file.name) + ' · Uploading…</span></div>';
        messagesEl.appendChild(tempRow);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    const removeTemp = function () {
        const el = document.getElementById(tempId);
        if (el) el.remove();
    };
    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/send-attachment",
            {
                method: "POST",
                headers: { "Authorization": "Bearer " + tokenValue },
                body: form
            }
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
            throw new Error(result.detail || "Attachment send failed.");
        }
        removeTemp();
    } catch (error) {
        removeTemp();
        alert(file.name + ": " + (error.message || "Attachment send failed."));
    }
}

document.getElementById("attachmentButton").addEventListener("click", function () {
    document.getElementById("attachmentInput").click();
});
let inboxCameraStream = null;
let inboxMediaRecorder = null;
let inboxCameraChunks = [];

function stopInboxCamera() {
    if (inboxMediaRecorder && inboxMediaRecorder.state !== "inactive") inboxMediaRecorder.stop();
    inboxMediaRecorder = null;
    if (inboxCameraStream) inboxCameraStream.getTracks().forEach(function (track) { track.stop(); });
    inboxCameraStream = null;
    const preview = document.getElementById("inboxCameraPreview");
    if (preview) preview.srcObject = null;
    const camera = document.getElementById("inboxCamera");
    if (camera) camera.hidden = true;
    const recordButton = document.getElementById("inboxCameraRecord");
    if (recordButton) recordButton.textContent = "Record video";
}

async function openInboxCamera() {
    if (!selectedWaId) {
        alert("Please select a conversation first.");
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById("cameraInput").click();
        return;
    }
    const camera = document.getElementById("inboxCamera");
    const preview = document.getElementById("inboxCameraPreview");
    try {
        inboxCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: true
        });
        preview.srcObject = inboxCameraStream;
        camera.hidden = false;
        await preview.play();
    } catch (error) {
        stopInboxCamera();
        alert("Camera could not be opened. Please allow camera access, then try again.");
    }
}

function captureInboxPhoto() {
    const preview = document.getElementById("inboxCameraPreview");
    if (!preview || !preview.videoWidth || !preview.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    canvas.getContext("2d").drawImage(preview, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(function (blob) {
        if (!blob) return;
        const file = new File([blob], "camera-photo-" + Date.now() + ".jpg", { type: "image/jpeg" });
        stopInboxCamera();
        openAttachmentComposer([file]);
    }, "image/jpeg", .92);
}

function toggleInboxVideoRecording() {
    const button = document.getElementById("inboxCameraRecord");
    if (!inboxCameraStream || !button) return;
    if (inboxMediaRecorder && inboxMediaRecorder.state === "recording") {
        inboxMediaRecorder.stop();
        return;
    }
    try {
        inboxCameraChunks = [];
        inboxMediaRecorder = new MediaRecorder(inboxCameraStream);
        inboxMediaRecorder.addEventListener("dataavailable", function (event) {
            if (event.data && event.data.size) inboxCameraChunks.push(event.data);
        });
        inboxMediaRecorder.addEventListener("stop", function () {
            const mimeType = inboxCameraChunks[0] ? inboxCameraChunks[0].type : "video/webm";
            const blob = new Blob(inboxCameraChunks, { type: mimeType || "video/webm" });
            stopInboxCamera();
            if (blob.size) openAttachmentComposer([new File([blob], "camera-video-" + Date.now() + ".webm", { type: mimeType || "video/webm" })]);
        }, { once: true });
        inboxMediaRecorder.start();
        button.textContent = "Stop video";
    } catch (error) {
        alert("Video recording is not supported in this browser.");
    }
}

document.getElementById("cameraButton").addEventListener("click", openInboxCamera);
document.getElementById("inboxCameraCancel").addEventListener("click", stopInboxCamera);
document.getElementById("inboxCameraPhoto").addEventListener("click", captureInboxPhoto);
document.getElementById("inboxCameraRecord").addEventListener("click", toggleInboxVideoRecording);
document.getElementById("attachmentInput").addEventListener("change", function () {
    sendInboxAttachment("attachmentInput");
});
document.getElementById("cameraInput").addEventListener("change", function () {
    sendInboxAttachment("cameraInput");
});
const emojiPicker = document.getElementById("emojiPicker");
const emojiButton = document.getElementById("emojiButton");
const inboxEmojis = [128512, 128513, 128514, 128515, 128516, 128517, 128518, 128519, 128520, 128521, 128522, 128523, 128524, 128525, 128526, 128527, 128528, 128529, 128530, 128531, 128532, 128533, 128534, 128535, 128536, 128537, 128538, 128539, 128540, 128541, 128077, 128078, 128079, 128080, 128076, 9996, 128591, 128588, 128170, 128150, 10084, 128525, 128293, 128165, 128640, 9989, 127881, 127775, 128176, 128293, 128064, 128521, 128148, 128151, 128171, 128526, 129303, 129321, 129312, 129315, 129395, 129392, 129488, 129392, 129505, 128175, 128214, 128073, 128161, 127919, 127942, 127925, 127926, 127952, 127881, 127873, 127872, 127801, 127800, 127752];
if (emojiPicker && emojiButton) {
    emojiPicker.innerHTML = inboxEmojis.map(function (code) {
        return '<button type="button" data-inbox-emoji="' + code + '">' + String.fromCodePoint(code) + '</button>';
    }).join("");
    emojiButton.addEventListener("click", function (event) {
        event.stopPropagation();
        emojiPicker.hidden = !emojiPicker.hidden;
    });
    emojiPicker.addEventListener("click", function (event) {
        const emoji = event.target.closest("[data-inbox-emoji]");
        if (!emoji) return;
        const input = document.getElementById("messageInput");
        input.value += String.fromCodePoint(Number(emoji.getAttribute("data-inbox-emoji")));
        emojiPicker.hidden = true;
        input.focus();
    });
    document.addEventListener("click", function (event) {
        if (!event.target.closest("#emojiPicker") && !event.target.closest("#emojiButton")) emojiPicker.hidden = true;
    });
}
document.getElementById("inboxComposerCancel").addEventListener("click", closeAttachmentComposer);
document.getElementById("inboxComposerSend").addEventListener("click", async function () {
    const files = pendingComposerFiles.slice();
    if (!files.length) {
        closeAttachmentComposer();
        return;
    }
    const captionEl = document.getElementById("inboxComposerCaption");
    const caption = captionEl ? captionEl.value.trim() : "";
    closeAttachmentComposer();
    await doSendInboxAttachment(files, caption);
});

document.getElementById("inboxCropperCancel").addEventListener("click", closeCropOverlay);
document.getElementById("inboxCropperApply").addEventListener("click", applyCrop);
document.getElementById("inboxCropperReset").addEventListener("click", resetCropSelection);

(function () {
    const stage = document.getElementById("inboxCropperStage");
    const sel = document.getElementById("inboxCropperSelection");
    if (!stage || !sel) return;

    let drag = null;

    const getPos = function (e) {
        const rect = stage.getBoundingClientRect();
        const p = e.touches && e.touches[0] ? e.touches[0] : e;
        return { x: p.clientX - rect.left, y: p.clientY - rect.top, rect: rect };
    };

    const beginDrag = function (e, mode, handle) {
        if (!cropState) return;
        const pos = getPos(e);
        drag = {
            mode: mode,
            handle: handle,
            startX: pos.x,
            startY: pos.y,
            origX: cropState.x,
            origY: cropState.y,
            origW: cropState.w,
            origH: cropState.h,
            stageW: pos.rect.width,
            stageH: pos.rect.height
        };
        e.preventDefault();
        e.stopPropagation();
    };

    const start = function (e) {
        if (!cropState) return;
        const handleEl = e.target.closest("[data-crop-handle]");
        if (handleEl) {
            beginDrag(e, "resize", handleEl.dataset.cropHandle);
            return;
        }
        if (e.target.closest("#inboxCropperSelection")) {
            beginDrag(e, "move", null);
            return;
        }
        const pos = getPos(e);
        cropState.x = pos.x; cropState.y = pos.y;
        cropState.w = 1; cropState.h = 1;
        updateCropSelection();
        drag = {
            mode: "new",
            handle: null,
            startX: pos.x,
            startY: pos.y,
            origX: pos.x,
            origY: pos.y,
            origW: 0,
            origH: 0,
            stageW: pos.rect.width,
            stageH: pos.rect.height
        };
        e.preventDefault();
    };

    const move = function (e) {
        if (!drag || !cropState) return;
        const pos = getPos(e);
        const rect = pos.rect;
        const minSize = 20;
        let nx = cropState.x, ny = cropState.y, nw = cropState.w, nh = cropState.h;
        if (drag.mode === "new") {
            const x0 = Math.max(0, Math.min(pos.x, drag.startX));
            const y0 = Math.max(0, Math.min(pos.y, drag.startY));
            const x1 = Math.min(rect.width, Math.max(pos.x, drag.startX));
            const y1 = Math.min(rect.height, Math.max(pos.y, drag.startY));
            nx = x0; ny = y0; nw = Math.max(1, x1 - x0); nh = Math.max(1, y1 - y0);
        } else if (drag.mode === "move") {
            const dx = pos.x - drag.startX;
            const dy = pos.y - drag.startY;
            nx = Math.max(0, Math.min(rect.width - drag.origW, drag.origX + dx));
            ny = Math.max(0, Math.min(rect.height - drag.origH, drag.origY + dy));
            nw = drag.origW; nh = drag.origH;
        } else if (drag.mode === "resize") {
            const h = drag.handle;
            let left = drag.origX, top = drag.origY, right = drag.origX + drag.origW, bottom = drag.origY + drag.origH;
            if (h.indexOf("w") >= 0) left = Math.max(0, Math.min(pos.x, right - minSize));
            if (h.indexOf("e") >= 0) right = Math.min(rect.width, Math.max(pos.x, left + minSize));
            if (h.indexOf("n") >= 0) top = Math.max(0, Math.min(pos.y, bottom - minSize));
            if (h.indexOf("s") >= 0) bottom = Math.min(rect.height, Math.max(pos.y, top + minSize));
            nx = left; ny = top; nw = right - left; nh = bottom - top;
        }
        cropState.x = nx; cropState.y = ny; cropState.w = nw; cropState.h = nh;
        updateCropSelection();
        e.preventDefault();
    };

    const end = function (e) {
        if (!drag) return;
        const wasNew = drag.mode === "new";
        drag = null;
        if (wasNew && (cropState.w < 10 || cropState.h < 10)) resetCropSelection();
        if (e && e.preventDefault) e.preventDefault();
    };

    stage.addEventListener("mousedown", start);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    stage.addEventListener("touchstart", start, { passive: false });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { passive: false });
})();
document.getElementById("sendButton").addEventListener("click", sendMessage);

document.getElementById("messageInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});
document.getElementById("searchInput").addEventListener("input", function () {
    const search = this.value.toLowerCase().trim();

    renderContacts(
        contacts.filter(contact => {
            const text = (
                (contact.profile_name || "") + " " +
                (contact.name || "") + " " +
                (contact.phone_number || "") + " " +
                (contact.wa_id || "")
            ).toLowerCase();

            return text.includes(search);
        })
    );
});

document.getElementById("logoutButton").addEventListener("click", async function () {
    try {
        await fetch(
            "https://app.vbo.co.in/api/v1/auth/logout?token=" +
            encodeURIComponent(token),
            { method: "POST" }
        );
    } catch (error) {
        console.error(error);
    }

    localStorage.removeItem("vbonotif_token");
    localStorage.removeItem("vbonotif_client");

    window.location.href = "index.html";
});


function getMessageTicks(status) {
    if (status === "sent") {
        return '<span class="message-ticks">&#10003;</span>';
    }
    if (status === "delivered") {
        return '<span class="message-ticks">&#10003;&#10003;</span>';
    }
    if (status === "read") {
        return '<span class="message-ticks message-ticks-read">&#10003;&#10003;</span>';
    }
    if (status === "failed") {
        return '<span class="message-ticks message-ticks-failed">!</span>';
    }
    return '<span class="message-ticks">&#10003;</span>';
}

function formatTime(value) {
    return window.VBOTime ? window.VBOTime.time(value) : "";
}

function formatDateTime(value) {
    return window.VBOTime ? window.VBOTime.dateTime(value) : (value || "");
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function openInboxLightbox(src) {
    const box = document.getElementById("inboxLightbox");
    const img = document.getElementById("inboxLightboxImage");
    if (!box || !img) return;
    img.src = src;
    box.hidden = false;
    document.body.style.overflow = "hidden";
}

function closeInboxLightbox() {
    const box = document.getElementById("inboxLightbox");
    const img = document.getElementById("inboxLightboxImage");
    if (!box || !img) return;
    box.hidden = true;
    img.src = "";
    document.body.style.overflow = "";
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeInboxLightbox();
});
function downloadInboxMedia(url, filename) {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "attachment";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

loadClientName();
loadContacts();

document.addEventListener("click", function (event) {
    const cr = event.target.closest("[data-crop-index]");
    if (cr) {
        openCropOverlay(parseInt(cr.dataset.cropIndex, 10));
        return;
    }
    const rm = event.target.closest("[data-remove-index]");
    if (rm) {
        removeComposerFile(parseInt(rm.dataset.removeIndex, 10));
        return;
    }
    const dl = event.target.closest("[data-inbox-download-url]");
    if (dl) {
        const url = dl.getAttribute("data-inbox-download-url");
        const name = dl.getAttribute("data-inbox-download-name") || "attachment";
        downloadInboxMedia(url, name);
        return;
    }
    const img = event.target.closest(".inbox-media-image");
    if (img && img.src) {
        openInboxLightbox(img.src);
        return;
    }
    if (event.target.id === "inboxLightbox" || event.target.classList.contains("inbox-lightbox-close")) {
        closeInboxLightbox();
    }
});

function loadClientName() {
    const clientName = localStorage.getItem("vbonotif_client");
    const element = document.getElementById("clientName");

    if (element && clientName) {
        element.textContent = clientName;
    }
}










// Return from a mobile conversation to the chats list.
document.getElementById("chatBackButton").addEventListener("click", function () {
    document.querySelector(".inbox").classList.remove("mobile-chat-open");
});

document.getElementById("bulkCancel").addEventListener("click", function () {
    setBulkSelectMode(false);
});

document.getElementById("bulkDelete").addEventListener("click", function () {
    deleteBulkSelected();
});

document.getElementById("inboxToastClose").addEventListener("click", hideToast);

/* ============= Inbox delete / hide / undo - listeners ============= */

// Single-message delete button (delegated)
document.addEventListener("click", function (event) {
    const contactMenuBtn = event.target.closest("[data-contact-menu-id]");
    if (contactMenuBtn) {
        event.stopPropagation();
        const waId = contactMenuBtn.getAttribute("data-contact-menu-id");
        openContactMenu(contactMenuBtn, waId);
        return;
    }
    const contactMenuAction = event.target.closest("[data-contact-menu-action]");
    if (contactMenuAction) {
        const action = contactMenuAction.getAttribute("data-contact-menu-action");
        const waId = contactMenuAction.getAttribute("data-contact-menu-for");
        closeContactMenu();
        if (action === "select") {
            openChat(waId).then(function () {
                if (selectedWaId === waId) setBulkSelectMode(true);
            });
        } else if (action === "hide") {
            hideContactConversation(waId);
        } else if (action === "restore") {
            restoreContactConversation(waId);
        } else if (action === "block") {
            blockContactConversation(waId);
        } else if (action === "unblock") {
            unblockContactConversation(waId);
        }
        return;
    }
    const menuBtn = event.target.closest("[data-message-menu-id]");
    if (menuBtn) {
        event.stopPropagation();
        const id = menuBtn.getAttribute("data-message-menu-id");
        openMessageMenu(menuBtn, id);
        return;
    }
    const menuAction = event.target.closest("[data-message-menu-action]");
    if (menuAction) {
        const action = menuAction.getAttribute("data-message-menu-action");
        const id = menuAction.getAttribute("data-message-menu-for");
        closeMessageMenu();
        if (action === "delete") {
            if (!selectedWaId) return;
            deleteSingleMessage(selectedWaId, id);
        } else if (action === "select") {
            setBulkSelectMode(true);
            const row = document.querySelector('[data-message-id="' + id + '"]');
            const checkbox = row ? row.querySelector("[data-message-checkbox]") : null;
            if (checkbox) checkbox.checked = true;
            toggleBulkSelect(id, true);
        } else if (action === "download") {
            const row = document.querySelector('[data-message-id="' + id + '"]');
            const media = row ? row.querySelector(".inbox-media-image, .inbox-media-video, audio") : null;
            const fileLink = row ? row.querySelector(".inbox-attachment a[download]") : null;
            const src = media ? media.src : (fileLink ? fileLink.href : "");
            const name = media
                ? media.getAttribute("data-inbox-download-name")
                : (fileLink ? fileLink.getAttribute("download") : "");
            if (src) downloadInboxMedia(src, name || "attachment");
        }
        return;
    }
    if (event.target.matches("[data-message-checkbox]")) {
        return;
    }
    if (event.target.closest("#loadOlderMessages")) {
        loadOlderMessages();
        return;
    }
    const row = event.target.closest("[data-message-id]");
    if (row && bulkSelectMode) {
        const cb = row.querySelector("[data-message-checkbox]");
        const id = row.getAttribute("data-message-id");
        const now = !(cb && cb.checked);
        if (cb) cb.checked = now;
        toggleBulkSelect(id, now);
        return;
    }
});

// Checkbox change (direct click on the checkbox)
document.addEventListener("change", function (event) {
    const cb = event.target.closest("[data-message-checkbox]");
    if (!cb) return;
    const id = cb.getAttribute("data-message-checkbox");
    toggleBulkSelect(id, cb.checked);
});

// Bulk select toggle (via chat menu)
document.getElementById("chatMenuButton").addEventListener("click", function (event) {
    event.stopPropagation();
    const dd = document.getElementById("chatMenuDropdown");
    if (dd) dd.hidden = !dd.hidden;
});
document.getElementById("chatMenuSelectOption").addEventListener("click", function () {
    const dd = document.getElementById("chatMenuDropdown");
    if (dd) dd.hidden = true;
    setBulkSelectMode(true);
});
document.getElementById("chatMenuHideOption").addEventListener("click", function () {
    const dd = document.getElementById("chatMenuDropdown");
    if (dd) dd.hidden = true;
    if (!selectedWaId) return;
    if (showingArchived) restoreContactConversation(selectedWaId);
    else hideContactConversation(selectedWaId);
});
document.getElementById("chatMenuBlockOption").addEventListener("click", function () {
    const dd = document.getElementById("chatMenuDropdown");
    if (dd) dd.hidden = true;
    if (!selectedWaId) return;
    if (showingBlocked) unblockContactConversation(selectedWaId);
    else blockContactConversation(selectedWaId);
});
document.getElementById("inboxArchiveButton").addEventListener("click", function () {
    showingArchived = !showingArchived;
    showingBlocked = false;
    selectedWaId = null;
    chatRequestVersion++;
    hideMessageLoading();
    document.getElementById("chatView").classList.add("hidden");
    document.getElementById("emptyChat").classList.remove("hidden");
    loadContacts();
});
document.getElementById("inboxBlockedButton").addEventListener("click", function () {
    showingBlocked = !showingBlocked;
    showingArchived = false;
    selectedWaId = null;
    chatRequestVersion++;
    hideMessageLoading();
    document.getElementById("chatView").classList.add("hidden");
    document.getElementById("emptyChat").classList.remove("hidden");
    loadContacts();
});
document.addEventListener("click", function (event) {
    const dd = document.getElementById("chatMenuDropdown");
    if (!dd || dd.hidden) return;
    if (event.target.closest("#chatMenuDropdown") || event.target.closest("#chatMenuButton")) return;
    dd.hidden = true;
});

// Contact-list item long-press -> hide chat (delegated, uses contextmenu + long-press)
(function () {
    const list = document.getElementById("contactList");
    if (!list) return;
    let pressTimer = null;
    let pressTarget = null;
    const startPress = function (e) {
        const item = e.target.closest("[data-wa-id]");
        if (!item) return;
        pressTarget = item.getAttribute("data-wa-id");
        pressTimer = setTimeout(function () {
            pressTimer = null;
            hideContactConversation(pressTarget);
        }, 600);
    };
    const cancelPress = function () {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        pressTarget = null;
    };
    list.addEventListener("touchstart", startPress, { passive: true });
    list.addEventListener("touchend", cancelPress);
    list.addEventListener("touchcancel", cancelPress);
    list.addEventListener("touchmove", cancelPress);
    list.addEventListener("contextmenu", function (e) {
        const item = e.target.closest("[data-wa-id]");
        if (!item) return;
        e.preventDefault();
        hideContactConversation(item.getAttribute("data-wa-id"));
    });
})();
