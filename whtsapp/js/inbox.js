const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

let contacts = [];
let selectedWaId = null;
let inboxTemplates = null;

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

async function loadContacts() {
    const list = document.getElementById("contactList");

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/contacts",
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

        if (requestedWaId) {
            setTimeout(() => {
                openChat(requestedWaId);
            }, 100);
        }

    } catch (error) {
        list.innerHTML =
            '<div class="loading">Unable to load conversations.</div>';
        console.error(error);
    }
}

function renderContacts(items) {
    const list = document.getElementById("contactList");

    if (!items.length) {
        list.innerHTML =
            '<div class="loading">No conversations yet.</div>';
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
                    <div class="contact-last">
                        ${escapeHtml(contact.last_message || "No messages")}
                    </div>
                </div>
            </div>
        `;
    }).join("");

    document.querySelectorAll(".contact").forEach(item => {
        item.addEventListener("click", () => {
            openChat(item.dataset.waId);
        });
    });
}

async function openChat(waId) {
    selectedWaId = waId;

    renderContacts(
        contacts.filter(contact =>
            true
        )
    );

    const empty = document.getElementById("emptyChat");
    const chat = document.getElementById("chatView");

    empty.classList.add("hidden");
    chat.classList.remove("hidden");

    try {
        const response = await fetch(
            "https://app.vbo.co.in/api/v1/whatsapp/inbox/messages/" +
            encodeURIComponent(waId),
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

        renderMessages(data.messages || []);

        document.getElementById("messageInput").focus();

    } catch (error) {
        console.error(error);
    }
}

async function renderMessages(messages) {
    const container = document.getElementById("messages");

    if (!messages.length) {
        container.innerHTML =
            '<div class="loading">No messages in this conversation.</div>';
        return;
    }

    await loadInboxTemplates();

    container.innerHTML = messages.map(message => {
        const rawText = String(message.message_text || "");
        const templateMatch = rawText.match(/\[Template:\s*([^\]]+)\]/i);

        let messageHtml = "";
        let templateLabel = "";

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
                            <span class="template-button-icon">↗</span>
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
            messageHtml = escapeHtml(rawText || "[No text message]");
        }

        return `
            <div class="message-row ${message.direction}">
                <div class="message-bubble">
                    ${messageHtml}
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
                </div>
            </div>
        `;
    }).join("");

    container.scrollTop = container.scrollHeight;
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

loadClientName();
loadContacts();

function loadClientName() {
    const clientName = localStorage.getItem("vbonotif_client");
    const element = document.getElementById("clientName");

    if (element && clientName) {
        element.textContent = clientName;
    }
}









