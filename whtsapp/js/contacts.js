const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

const API_BASE = "https://app.vbo.co.in/api/v1/whatsapp";

let allContacts = [];

function loadClientName() {
    const clientName = localStorage.getItem("vbonotif_client");
    const element = document.getElementById("clientName");

    if (element && clientName) {
        element.textContent = clientName;
    }
}

async function loadContacts() {
    try {
        const response = await fetch(
            API_BASE + "/inbox/contacts",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail || "Unable to load contacts."
            );
        }

        allContacts = Array.isArray(data) ? data : (data.contacts || []);

        const searchInput = document.getElementById("searchInput");
        const search = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        if (!search) {
            renderContacts(allContacts);
        } else {
            const filtered = allContacts.filter(contact => {

                const name =
                    contact.profile_name ||
                    contact.name ||
                    "";

                const waId =
                    contact.wa_id ||
                    contact.phone_number ||
                    "";

                return (
                    String(name).toLowerCase().includes(search) ||
                    String(waId).toLowerCase().includes(search)
                );
            });

            renderContacts(filtered);
        }

    } catch (error) {
        console.error("CONTACT LOAD ERROR:", error);

        document.getElementById("contactsList").innerHTML =
            '<div class="error-state">Unable to load contacts.</div>';

        document.getElementById("contactSummary").textContent =
            "Unable to load contacts";
    }
}

function renderContacts(contacts) {
    const container = document.getElementById("contactsList");
    const summary = document.getElementById("contactSummary");

    summary.textContent =
        contacts.length +
        (contacts.length === 1 ? " contact" : " contacts");

    if (!contacts.length) {
        container.innerHTML =
            '<div class="empty-state">No contacts found.</div>';
        return;
    }

    container.innerHTML = contacts.map(contact => {

        const name =
            contact.profile_name ||
            contact.name ||
            contact.wa_id ||
            "Unknown";

        const waId =
            contact.wa_id ||
            contact.phone_number ||
            "";

        const initial =
            name.trim().charAt(0).toUpperCase() || "?";

        const lastInteraction =
            contact.last_message_time ||
            "-";

        return `
            <div class="contact-row">

                <div class="contact-name">
                    <div class="contact-avatar">${escapeHtml(initial)}</div>

                    <div class="contact-name-text">
                        <strong>${escapeHtml(name)}</strong>
                        <small>${escapeHtml(waId)}</small>
                    </div>
                </div>

                <div class="contact-number">
                    ${escapeHtml(waId)}
                </div>

                <div class="contact-status">
                    Active
                </div>

                <div class="contact-last">
                    ${escapeHtml(formatDate(lastInteraction))}
                </div>

                <div class="contact-action">
                    <button
                        class="open-chat"
                        data-wa-id="${escapeHtml(waId)}"
                    >
                        Open Chat
                    </button>
                </div>

            </div>
        `;
    }).join("");

    document.querySelectorAll(".open-chat").forEach(button => {
        button.addEventListener("click", function () {
            const waId = this.getAttribute("data-wa-id");

            if (!waId) return;

            window.location.href =
                "inbox.html?wa_id=" +
                encodeURIComponent(waId);
        });
    });
}

function formatDate(value) {
    if (!value || value === "-") {
        return "-";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
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

document.getElementById("searchInput").addEventListener(
    "input",
    function () {

        const search = this.value
            .trim()
            .toLowerCase();

        if (!search) {
            renderContacts(allContacts);
            return;
        }

        const filtered = allContacts.filter(contact => {

            const name =
                contact.profile_name ||
                contact.name ||
                "";

            const waId =
                contact.wa_id ||
                contact.phone_number ||
                "";

            return (
                String(name).toLowerCase().includes(search) ||
                String(waId).toLowerCase().includes(search)
            );
        });

        renderContacts(filtered);
    }
);

document.getElementById("logoutButton").addEventListener(
    "click",
    function () {

        localStorage.removeItem("vbonotif_token");
        localStorage.removeItem("vbonotif_client");

        window.location.href = "index.html";
    }
);

loadClientName();
loadContacts();



