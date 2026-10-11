const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

const API_BASE = "https://app.vbo.co.in/api/v1";

let messageRate = 0;
let groups = [];
let templates = [];
let currentMode = "single";

function showStatus(message, type) {
    const element = document.getElementById("messageStatus");
    if (!element) return;

    element.textContent = message;
    element.className = "message-status " + type;
}

function normalizeNumber(value) {
    return String(value || "").replace(/[^\d]/g, "");
}

function getMultipleNumbers() {
    const input = document.getElementById("multipleNumbers");
    if (!input) return [];

    const values = input.value
        .split(/[\n,;]+/)
        .map(normalizeNumber)
        .filter(Boolean);

    return [...new Set(values)];
}

function getSelectedRecipientCount() {
    if (currentMode === "single") {
        const number = normalizeNumber(
            document.getElementById("singleNumber")?.value
        );
        return number ? 1 : 0;
    }

    if (currentMode === "multiple") {
        return getMultipleNumbers().length;
    }

    if (currentMode === "group") {
        const select = document.getElementById("groupSelect");
        const selected = groups.find(
            group => String(group.id) === String(select?.value)
        );

        return Number(selected?.member_count || 0);
    }

    return 0;
}

function updateCharge() {
    const count = getSelectedRecipientCount();
    const charge = messageRate * count;

    const element = document.getElementById("messageCharge");

    if (element) {
        element.textContent = "₹" + charge.toFixed(2);
    }
}

async function loadClientInfo() {
    try {
        const response = await fetch(
            API_BASE + "/auth/me",
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

        const clientName =
            data.client_name ||
            data.client?.client_name ||
            localStorage.getItem("vbonotif_client") ||
            "Client";

        document.getElementById("clientName").textContent = clientName;

        const pricing =
            data.pricing ||
            data.client?.pricing ||
            {};

        messageRate = Number(pricing.text_message || 0);

        updateCharge();

    } catch (error) {
        console.error("CLIENT INFO ERROR:", error);

        const savedClient =
            localStorage.getItem("vbonotif_client");

        if (savedClient) {
            document.getElementById("clientName").textContent =
                savedClient;
        }

        updateCharge();
    }
}

async function loadGroups() {
    const select = document.getElementById("groupSelect");

    if (!select) return;

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/contact-groups",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load contact groups.");
        }

        const data = await response.json();

        groups = data.groups || [];

        select.innerHTML =
            '<option value="">Select a contact group...</option>';

        groups.forEach(function(group) {
            const option = document.createElement("option");

            option.value = group.id;

            option.textContent =
                group.group_name +
                " (" +
                Number(group.member_count || 0) +
                " numbers)";

            select.appendChild(option);
        });

        if (groups.length === 0) {
            select.innerHTML =
                '<option value="">No contact groups available</option>';
        }

        updateCharge();

    } catch (error) {
        console.error("GROUP LOAD ERROR:", error);

        select.innerHTML =
            '<option value="">Unable to load groups</option>';

        showStatus(
            "Unable to load contact groups.",
            "error"
        );
    }
}

async function loadTemplates() {
    const select = document.getElementById("templateSelect");

    if (!select) return;

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/templates",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load templates.");
        }

        const data = await response.json();

        templates = data.templates || [];

        select.innerHTML =
            '<option value="">No template — type message manually</option>';

        templates.forEach(function(template) {
            const option = document.createElement("option");

            option.value = template.id;

            option.textContent =
                (template.template_name || "Template") +
                " — " +
                (template.status || "draft");

            select.appendChild(option);
        });

    } catch (error) {
        console.error("TEMPLATE LOAD ERROR:", error);

        select.innerHTML =
            '<option value="">Templates unavailable</option>';
    }
}

function applySelectedTemplate() {
    const select = document.getElementById("templateSelect");
    const input = document.getElementById("messageInput");

    if (!select || !input) return;

    const templateId = select.value;

    if (!templateId) {
        return;
    }

    const template = templates.find(
        item => String(item.id) === String(templateId)
    );

    if (!template) return;

    const body =
        template.body_text ||
        template.content ||
        "";

    input.value = body;

    input.focus();
}

function setMode(mode) {
    currentMode = mode;

    document.querySelectorAll(".mode-button").forEach(function(button) {
        button.classList.toggle(
            "active",
            button.dataset.mode === mode
        );
    });

    const singleMode = document.getElementById("singleMode");
    const multipleMode = document.getElementById("multipleMode");
    const groupMode = document.getElementById("groupMode");

    if (singleMode) {
        singleMode.classList.toggle(
            "hidden",
            mode !== "single"
        );
    }

    if (multipleMode) {
        multipleMode.classList.toggle(
            "hidden",
            mode !== "multiple"
        );
    }

    if (groupMode) {
        groupMode.classList.toggle(
            "hidden",
            mode !== "group"
        );
    }

    updateCharge();
}

function setupModeButtons() {
    document.querySelectorAll(".mode-button").forEach(function(button) {
        button.addEventListener("click", function() {
            setMode(button.dataset.mode);
        });
    });
}

function setupScheduleFields() {
    const radios = document.querySelectorAll('input[name="sendTiming"]');
    const fields = document.getElementById("scheduleFields");
    const dateInput = document.getElementById("scheduleDate");
    const slotSelect = document.getElementById("scheduleSlot");

    function populateSlots() {
        if (!slotSelect) return;

        const selectedDate = dateInput?.value || "";
        const nowParts = window.VBOTime ? window.VBOTime.parts(new Date()) : null;
        const now = new Date();
        const today = window.VBOTime
            ? window.VBOTime.dateInput(now)
            : now.getFullYear() + "-" +
                String(now.getMonth() + 1).padStart(2, "0") + "-" +
                String(now.getDate()).padStart(2, "0");
        const currentHour = nowParts ? Number(nowParts.hour) : now.getHours();
        const currentSlotHour = Math.floor(currentHour / 2) * 2;

        slotSelect.innerHTML = '<option value="">Select 2-hour slot</option>';

        for (let hour = 0; hour < 24; hour += 2) {
            const endHour = (hour + 2) % 24;
            const start = String(hour).padStart(2, "0") + ":00";
            const end = String(endHour).padStart(2, "0") + ":00";
            const option = document.createElement("option");

            option.value = start;
            option.textContent = start + " – " + end;

            // Current slot and every earlier slot are disabled for today.
            if (selectedDate === today && hour <= currentSlotHour) {
                option.disabled = true;
            }

            slotSelect.appendChild(option);
        }
    }

    if (dateInput) {
        if (!dateInput.value) {
            dateInput.value = window.VBOTime
                ? window.VBOTime.dateInput(new Date())
                : new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0") + "-" + String(new Date().getDate()).padStart(2, "0");
        }
        dateInput.addEventListener("change", populateSlots);
    }

    radios.forEach(function(radio) {
        radio.addEventListener("change", function() {
            if (fields) {
                fields.classList.toggle(
                    "hidden",
                    radio.value !== "schedule" || !radio.checked
                );
            }
            if (radio.checked && radio.value === "schedule") {
                populateSlots();
            }
        });
    });

    populateSlots();
}

async function createGroup() {

    const groupName = prompt(
        "Enter group name:"
    );

    if (!groupName || !groupName.trim()) {
        return;
    }

    const numbersText = prompt(
        "Enter WhatsApp numbers, one per line:"
    );

    const numbers = String(numbersText || "")
        .split(/[\n,;]+/)
        .map(normalizeNumber)
        .filter(Boolean);

    const uniqueNumbers = [...new Set(numbers)];

    if (uniqueNumbers.length === 0) {
        showStatus(
            "Please enter at least one number.",
            "error"
        );
        return;
    }

    try {

        const response = await fetch(
            API_BASE + "/whatsapp/contact-groups",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    group_name: groupName.trim(),
                    description: ""
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Unable to create group."
            );
        }

        const groupId = data.group_id;

        let added = 0;

        for (const phoneNumber of uniqueNumbers) {

            try {

                const memberResponse = await fetch(
                    API_BASE +
                    "/whatsapp/contact-groups/" +
                    groupId +
                    "/members",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": "Bearer " + token,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            phone_number: phoneNumber,
                            name: ""
                        })
                    }
                );

                if (memberResponse.ok) {
                    added++;
                }

            } catch (error) {
                console.error(
                    "GROUP MEMBER ADD ERROR:",
                    phoneNumber,
                    error
                );
            }
        }

        await loadGroups();

        const select =
            document.getElementById("groupSelect");

        if (select) {
            select.value = String(groupId);
        }

        setMode("group");

        showStatus(
            "Group created successfully. " +
            added +
            " number(s) added.",
            "success"
        );

    } catch (error) {

        console.error(
            "CREATE GROUP ERROR:",
            error
        );

        showStatus(
            error.message ||
            "Unable to create group.",
            "error"
        );
    }
}

async function manageGroup() {

    const select =
        document.getElementById("groupSelect");

    const groupId = select?.value;

    if (!groupId) {
        showStatus(
            "Please select a group first.",
            "error"
        );
        return;
    }

    try {

        const response = await fetch(
            API_BASE +
            "/whatsapp/contact-groups/" +
            groupId,
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Unable to load group."
            );
        }

        const group = data.group || {};
        const members = data.members || [];

        const memberText = members.length
            ? members.map(function(member, index) {
                return (
                    (index + 1) +
                    ". " +
                    (member.name || "Number") +
                    " — " +
                    member.phone_number
                );
            }).join("\n")
            : "No members.";

        alert(
            "Group: " +
            group.group_name +
            "\n\nMembers (" +
            members.length +
            "):\n\n" +
            memberText
        );

    } catch (error) {

        console.error(
            "MANAGE GROUP ERROR:",
            error
        );

        showStatus(
            error.message ||
            "Unable to load group.",
            "error"
        );
    }
}

async function getTemplateParameters(template) {

    const body =
        template?.body_text ||
        template?.content ||
        "";

    const matches =
        [...body.matchAll(/\{\{(\d+)\}\}/g)]
        .map(match => Number(match[1]))
        .filter((value, index, array) =>
            array.indexOf(value) === index
        )
        .sort((a, b) => a - b);

    if (matches.length === 0) {
        return [];
    }

    const parameters = [];

    for (const number of matches) {

        const value = window.prompt(
            "Enter value for template variable {{" +
            number +
            "}}:"
        );

        if (value === null) {
            throw new Error("Template sending cancelled.");
        }

        if (!String(value).trim()) {
            throw new Error(
                "Template variable {{" +
                number +
                "}} cannot be empty."
            );
        }

        parameters.push(String(value).trim());
    }

    return parameters;
}


async function sendTemplateToNumber(
    number,
    template,
    parameters
) {

    const response = await fetch(
        API_BASE + "/whatsapp/inbox/send-template",
        {
            method: "POST",

            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                wa_id: number,
                template_id: Number(template.id),
                parameters: parameters
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(
            data.detail?.message ||
            data.detail ||
            "Template message could not be sent."
        );
    }

    return data;
}


async function getGroupRecipients(groupId) {

    const response = await fetch(
        API_BASE +
        "/whatsapp/contact-groups/" +
        groupId,

        {
            headers: {
                "Authorization": "Bearer " + token
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(
            data.detail ||
            "Unable to load contact group."
        );
    }

    return (data.members || [])
        .map(member =>
            normalizeNumber(member.phone_number)
        )
        .filter(Boolean);
}


async function sendMessage() {

    const input =
        document.getElementById("messageInput");

    const button =
        document.getElementById("sendButton");

    const message =
        input?.value.trim();

    const selectedTemplateId =
        document.getElementById(
            "templateSelect"
        )?.value || "";

    const selectedTemplate =
        selectedTemplateId
            ? templates.find(
                item =>
                    String(item.id) ===
                    String(selectedTemplateId)
            )
            : null;


    if (!selectedTemplate && !message) {

        showStatus(
            "Please enter a message.",
            "error"
        );

        input?.focus();

        return;
    }


    const scheduleRadio =
        document.querySelector(
            'input[name="sendTiming"]:checked'
        );

    const timing =
        scheduleRadio?.value || "now";


    if (timing === "schedule") {

        const scheduleDate =
            document.getElementById("scheduleDate")?.value || "";

        const scheduleSlot =
            document.getElementById("scheduleSlot")?.value || "";

        if (!scheduleDate || !scheduleSlot) {
            showStatus(
                "Please select a future 2-hour slot.",
                "error"
            );
            return;
        }

        let recipients = [];
        let groupId = null;

        if (currentMode === "single") {
            const number = normalizeNumber(
                document.getElementById("singleNumber")?.value
            );

            if (!number || number.length < 10) {
                showStatus(
                    "Please enter a valid WhatsApp number.",
                    "error"
                );
                return;
            }

            recipients = [number];

        } else if (currentMode === "multiple") {
            recipients = getMultipleNumbers();

            if (recipients.length === 0) {
                showStatus(
                    "Please enter at least one number.",
                    "error"
                );
                return;
            }

        } else if (currentMode === "group") {
            groupId =
                document.getElementById("groupSelect")?.value || null;

            if (!groupId) {
                showStatus(
                    "Please select a contact group.",
                    "error"
                );
                return;
            }
        }

        button.disabled = true;
        button.textContent = "Scheduling...";

        try {
            let parameters = [];

            if (selectedTemplate) {
                const status =
                    String(selectedTemplate.status || "").toLowerCase();

                if (status !== "approved") {
                    throw new Error(
                        "Selected template is not approved by Meta."
                    );
                }

                parameters = await getTemplateParameters(selectedTemplate);
            }

            const response = await fetch(
                API_BASE + "/whatsapp/inbox/schedule",
                {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + token,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        recipients: recipients,
                        group_id: groupId ? Number(groupId) : null,
                        message: message,
                        template_id: selectedTemplate
                            ? Number(selectedTemplate.id)
                            : null,
                        parameters: parameters,
                        scheduled_at: scheduleDate + "T" + scheduleSlot
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail?.message ||
                    data.detail ||
                    "Message could not be scheduled."
                );
            }

            showStatus(
                "Scheduled successfully. 2-hour slot reserved.",
                "success"
            );

            input.value = "";
            updateCharge();

        } catch (error) {
            console.error("SCHEDULE MESSAGE ERROR:", error);
            showStatus(
                error.message || "Unable to schedule message.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = "Send WhatsApp Message";
        }

        return;
    }

    button.disabled = true;

    button.textContent =
        selectedTemplate
            ? "Sending Template..."
            : "Sending...";


    try {

        /*
         * ==========================================
         * META TEMPLATE SEND
         * ==========================================
         */

        if (selectedTemplate) {

            const status =
                String(
                    selectedTemplate.status || ""
                ).toLowerCase();


            if (status !== "approved") {

                throw new Error(
                    "Only Meta-approved templates can be sent."
                );
            }


            if (!selectedTemplate.meta_template_id) {

                throw new Error(
                    "This template has not been connected to Meta yet."
                );
            }


            const parameters =
                await getTemplateParameters(
                    selectedTemplate
                );


            let recipients = [];


            if (currentMode === "single") {

                const number =
                    normalizeNumber(
                        document.getElementById(
                            "singleNumber"
                        )?.value
                    );


                if (!number || number.length < 10) {

                    throw new Error(
                        "Please enter a valid phone number."
                    );
                }


                recipients = [number];


            } else if (currentMode === "multiple") {

                recipients =
                    getMultipleNumbers();


                if (recipients.length === 0) {

                    throw new Error(
                        "Please enter at least one number."
                    );
                }


            } else if (currentMode === "group") {

                const groupId =
                    document.getElementById(
                        "groupSelect"
                    )?.value;


                if (!groupId) {

                    throw new Error(
                        "Please select a contact group."
                    );
                }


                recipients =
                    await getGroupRecipients(
                        groupId
                    );
            }


            recipients =
                [...new Set(recipients)];


            if (recipients.length === 0) {

                throw new Error(
                    "No recipients found."
                );
            }


            let sentCount = 0;
            let failedCount = 0;
            let lastError = "";


            for (const number of recipients) {

                try {

                    await sendTemplateToNumber(
                        number,
                        selectedTemplate,
                        parameters
                    );

                    sentCount++;

                } catch (error) {

                    failedCount++;

                    lastError =
                        error.message ||
                        "Send failed.";

                    console.error(
                        "TEMPLATE SEND ERROR:",
                        number,
                        error
                    );
                }
            }


            if (sentCount === 0) {

                throw new Error(
                    lastError ||
                    "Template message could not be sent."
                );
            }


            showStatus(
                "Template send completed: " +
                sentCount +
                " sent, " +
                failedCount +
                " failed.",

                failedCount > 0
                    ? "error"
                    : "success"
            );


            console.log(
                "TEMPLATE SEND SUCCESS:",
                {
                    template:
                        selectedTemplate.template_name,

                    sentCount:
                        sentCount,

                    failedCount:
                        failedCount
                }
            );


            updateCharge();

            return;
        }


        /*
         * ==========================================
         * NORMAL TEXT MESSAGE SEND
         * ==========================================
         */

        let payload = {};
        let endpoint = "";


        if (currentMode === "single") {

            const number =
                normalizeNumber(
                    document.getElementById(
                        "singleNumber"
                    )?.value
                );


            if (!number) {

                showStatus(
                    "Please enter a WhatsApp number.",
                    "error"
                );

                document.getElementById(
                    "singleNumber"
                )?.focus();

                return;
            }


            if (number.length < 10) {

                showStatus(
                    "Please enter a valid phone number.",
                    "error"
                );

                return;
            }


            endpoint =
                API_BASE +
                "/whatsapp/inbox/send";


            payload = {
                wa_id: number,
                message: message
            };


        } else {

            let recipients = [];
            let groupId = null;


            if (currentMode === "multiple") {

                recipients =
                    getMultipleNumbers();


                if (recipients.length === 0) {

                    showStatus(
                        "Please enter at least one number.",
                        "error"
                    );

                    return;
                }


            } else if (currentMode === "group") {

                const select =
                    document.getElementById(
                        "groupSelect"
                    );


                groupId =
                    select?.value || null;


                if (!groupId) {

                    showStatus(
                        "Please select a contact group.",
                        "error"
                    );

                    return;
                }
            }


            endpoint =
                API_BASE +
                "/whatsapp/inbox/send-bulk";


            payload = {

                recipients:
                    recipients,

                message:
                    message,

                group_id:
                    groupId
                        ? Number(groupId)
                        : null
            };
        }


        const response =
            await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            "Bearer " + token,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail?.message ||
                data.detail ||
                "Message could not be sent."
            );
        }


        if (currentMode === "single") {

            showStatus(
                "WhatsApp message sent successfully.",
                "success"
            );

        } else {

            showStatus(
                "Bulk send completed: " +
                Number(data.sent_count || 0) +
                " sent, " +
                Number(data.failed_count || 0) +
                " failed.",

                Number(data.failed_count || 0) > 0
                    ? "error"
                    : "success"
            );
        }


        input.value = "";

        updateCharge();


        console.log(
            "SEND MESSAGE SUCCESS:",
            data
        );


    } catch (error) {

        console.error(
            "SEND MESSAGE ERROR:",
            error
        );


        showStatus(
            error.message ||
            "Unable to send message.",
            "error"
        );


    } finally {

        button.disabled = false;

        button.textContent =
            "Send WhatsApp Message";
    }
}



// ============================================================
// SCHEDULE HISTORY
// ============================================================

let allSchedules = [];
let activeScheduleTab = "upcoming";

function formatScheduleDate(value) {
    if (!value) return "—";
    return window.VBOTime ? window.VBOTime.dateTimeFull(value) : String(value);
}

function scheduleStatusLabel(status) {
    const value = String(status || "").toLowerCase();
    if (value === "completed") return "Completed";
    if (value === "partial") return "Partial";
    if (value === "failed") return "Failed";
    if (value === "running") return "Running";
    if (value === "queued") return "Queued";
    return "Pending";
}

function isScheduleHistory(item) {
    return ["completed", "partial", "failed"].includes(
        String(item.status || "").toLowerCase()
    );
}

function renderScheduleHistory() {
    const container = document.getElementById("scheduleHistoryList");
    if (!container) return;

    const filtered = allSchedules.filter(function(item) {
        return activeScheduleTab === "history"
            ? isScheduleHistory(item)
            : !isScheduleHistory(item);
    });

    if (!filtered.length) {
        container.innerHTML =
            '<div class="empty-state">No schedules found.</div>';
        return;
    }

    container.innerHTML = filtered.map(function(item) {
        const status = String(item.status || "pending").toLowerCase();
        const statusClass = "status-" + status;
        const total = Number(item.total_recipients || 0);
        const sent = Number(item.sent_count || 0);
        const failed = Number(item.failed_count || 0);
        const message = String(item.message_text || "").trim();
        const canDelete = !isScheduleHistory(item) && status !== "running";

        return `
            <div class="schedule-history-item">
                <div class="schedule-history-main">
                    <div class="schedule-history-title-row">
                        <strong>${escapeHtml(item.message_type === "template" ? "Template Message" : (message || "WhatsApp Message"))}</strong>
                        <span class="schedule-status ${statusClass}">${scheduleStatusLabel(status)}</span>
                    </div>
                    <div class="schedule-history-meta">
                        <span>🕒 ${formatScheduleDate(item.scheduled_at)}</span>
                        <span>👥 ${total} recipients</span>
                        <span>✓ ${sent} sent</span>
                        <span>✕ ${failed} failed</span>
                    </div>
                    ${item.error_message ? `<div class="schedule-history-error">${escapeHtml(item.error_message)}</div>` : ""}
                </div>
                ${canDelete ? `<button type="button" class="schedule-delete-button" data-schedule-id="${Number(item.id)}">Delete</button>` : ""}
            </div>
        `;
    }).join("");

    container.querySelectorAll(".schedule-delete-button").forEach(function(button) {
        button.addEventListener("click", function() {
            deleteSchedule(Number(button.dataset.scheduleId));
        });
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadScheduleHistory() {
    const container = document.getElementById("scheduleHistoryList");
    if (container) {
        container.innerHTML = '<div class="empty-state">Loading schedules...</div>';
    }

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/inbox/schedules",
            {
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Unable to load schedules.");
        }

        allSchedules = Array.isArray(data.schedules)
            ? data.schedules
            : [];

        renderScheduleHistory();
    } catch (error) {
        console.error("SCHEDULE HISTORY ERROR:", error);
        if (container) {
            container.innerHTML =
                '<div class="empty-state">Unable to load schedule history.</div>';
        }
    }
}

async function deleteSchedule(scheduleId) {
    if (!scheduleId) return;
    if (!confirm("Delete this upcoming schedule?")) return;

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/inbox/schedules/" + scheduleId,
            {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + token
                }
            }
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Unable to delete schedule.");
        }

        await loadScheduleHistory();
        showStatus("Schedule deleted successfully.", "success");
    } catch (error) {
        console.error("SCHEDULE DELETE ERROR:", error);
        showStatus(error.message || "Unable to delete schedule.", "error");
    }
}

function setupScheduleHistory() {
    document.querySelectorAll(".schedule-history-tab").forEach(function(tab) {
        tab.addEventListener("click", function() {
            activeScheduleTab = tab.dataset.scheduleTab || "upcoming";
            document.querySelectorAll(".schedule-history-tab").forEach(function(item) {
                item.classList.toggle("active", item === tab);
            });
            renderScheduleHistory();
        });
    });

    document.getElementById("refreshScheduleHistory")?.addEventListener(
        "click",
        loadScheduleHistory
    );

    loadScheduleHistory();
}

function logout() {

    localStorage.removeItem(
        "vbonotif_token"
    );

    localStorage.removeItem(
        "vbonotif_client"
    );

    window.location.href =
        "index.html";
}

document
    .getElementById("sendButton")
    .addEventListener(
        "click",
        sendMessage
    );

document
    .getElementById("logoutButton")
    .addEventListener(
        "click",
        logout
    );

document
    .getElementById("templateSelect")
    ?.addEventListener(
        "change",
        applySelectedTemplate
    );

document
    .getElementById("groupSelect")
    ?.addEventListener(
        "change",
        updateCharge
    );

document
    .getElementById("singleNumber")
    ?.addEventListener(
        "input",
        updateCharge
    );

document
    .getElementById("multipleNumbers")
    ?.addEventListener(
        "input",
        updateCharge
    );

document
    .getElementById("createGroupButton")
    ?.addEventListener(
        "click",
        createGroup
    );

document
    .getElementById("manageGroupButton")
    ?.addEventListener(
        "click",
        manageGroup
    );

setupModeButtons();
setupScheduleFields();
setupScheduleHistory();

loadClientInfo();
loadGroups();
loadTemplates();
