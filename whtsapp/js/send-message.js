const token = localStorage.getItem("vbonotif_token");

if (!token) {
    window.location.href = "index.html";
}

const API_BASE = "https://app.vbo.co.in/api/v1";

let messageRate = 0;
let groups = [];
let templates = [];
let currentMode = "single";
let groupEditorMode = "create";
let groupEditorId = null;
let groupCsvText = "";
let groupImportRows = [];
let groupImportInvalidRows = [];
let currentGroupMembers = [];
let accountContacts = [];
let selectedExistingContacts = new Map();
let accountContactsLoaded = false;
let selectedGroupMemberIds = new Set();

function showThemeAlert(message, options) {
    if (window.VBOUI && typeof window.VBOUI.alert === "function") {
        return window.VBOUI.alert(message, options || {});
    }
    window.alert(message);
    return Promise.resolve(true);
}

function showThemeConfirm(message, options) {
    if (window.VBOUI && typeof window.VBOUI.confirm === "function") {
        return window.VBOUI.confirm(message, options || {});
    }
    return Promise.resolve(window.confirm(message));
}

function showStatus(message, type) {
    const element = document.getElementById("messageStatus");
    if (!element) return;

    element.textContent = message;
    element.className = "message-status " + type;
}

function normalizeNumber(value) {
    return String(value || "").replace(/[^\d]/g, "");
}

function isValidStoredGroupNumber(value) {
    return /^\d{7,15}$/.test(String(value || "").trim());
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
                cache: "no-store",
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
            API_BASE + "/whatsapp/contact-groups?ts=" + Date.now(),
            {
                cache: "no-store",
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
                " numbers" +
                (Number(group.invalid_member_count || 0)
                    ? ", " + Number(group.invalid_member_count) + " invalid"
                    : "") +
                ")";

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

function canonicalImportHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const groupImportAliases = {
    phone_number: [
        "phone", "phonenumber", "mobile", "mobilenumber", "number",
        "whatsapp", "whatsappnumber", "whatsappno", "waid", "contact",
        "contactnumber", "contactno", "mobileno"
    ],
    name: ["name", "fullname", "customername", "contactname"],
    email: ["email", "emailid", "mail", "mailid"],
    city: ["city", "location", "town"],
    project_name: ["project", "projectname"]
};

function resolveImportField(header) {
    const canonical = canonicalImportHeader(header);
    return Object.keys(groupImportAliases).find(field =>
        groupImportAliases[field].includes(canonical)
    ) || "";
}

function detectImportDelimiter(text) {
    const firstLine = String(text || "").split(/\r?\n/).find(line => line.trim()) || "";
    const candidates = [",", "\t", ";"];
    let selected = ",";
    let selectedCount = 0;

    candidates.forEach(delimiter => {
        const count = firstLine.split(delimiter).length - 1;
        if (count > selectedCount) {
            selected = delimiter;
            selectedCount = count;
        }
    });

    return selected;
}

function parseDelimitedRows(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    if (!source.trim()) return [];

    const delimiter = detectImportDelimiter(source);
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < source.length; index++) {
        const character = source[index];

        if (character === '"') {
            if (quoted && source[index + 1] === '"') {
                cell += '"';
                index++;
            } else {
                quoted = !quoted;
            }
        } else if (character === delimiter && !quoted) {
            row.push(cell.trim());
            cell = "";
        } else if ((character === "\n" || character === "\r") && !quoted) {
            if (character === "\r" && source[index + 1] === "\n") index++;
            row.push(cell.trim());
            if (row.some(value => String(value).trim())) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += character;
        }
    }

    row.push(cell.trim());
    if (row.some(value => String(value).trim())) rows.push(row);
    return rows;
}

function parseContactImport(text) {
    const rows = parseDelimitedRows(text);
    if (!rows.length) return { valid: [], invalid: [] };

    const firstRowFields = rows[0].map(resolveImportField);
    const hasHeader = firstRowFields.includes("phone_number");
    const headers = hasHeader
        ? rows.shift()
        : ["Phone", "Name", "Email", "City", "Project"];
    const fieldMap = headers.map(resolveImportField);
    let phoneIndex = fieldMap.indexOf("phone_number");

    if (phoneIndex < 0) phoneIndex = 0;

    const valid = [];
    const invalid = [];

    rows.forEach((values, rowIndex) => {
        const rawPhone = values[phoneIndex] || "";
        const phoneNumber = normalizeNumber(rawPhone);

        if (phoneNumber.length < 7 || phoneNumber.length > 15) {
            invalid.push({
                phone_number: rawPhone,
                reason: "Phone must contain 7 to 15 digits",
                row: rowIndex + (hasHeader ? 2 : 1)
            });
            return;
        }

        const contact = {
            phone_number: phoneNumber,
            name: "",
            email: "",
            city: "",
            project_name: "",
            custom_fields: {}
        };

        values.forEach((value, columnIndex) => {
            const trimmedValue = String(value || "").trim();
            if (!trimmedValue || columnIndex === phoneIndex) return;

            const standardField = fieldMap[columnIndex];
            if (standardField && standardField !== "phone_number") {
                contact[standardField] = trimmedValue;
                return;
            }

            if (hasHeader) {
                const customKey = String(headers[columnIndex] || "").trim();
                if (customKey) contact.custom_fields[customKey] = trimmedValue;
            }
        });

        valid.push(contact);
    });

    return { valid, invalid };
}

function mergeImportedContacts(contacts) {
    const byPhone = new Map();

    contacts.forEach(contact => {
        const current = byPhone.get(contact.phone_number);
        if (!current) {
            byPhone.set(contact.phone_number, contact);
            return;
        }

        ["name", "email", "city", "project_name"].forEach(field => {
            if (!current[field] && contact[field]) current[field] = contact[field];
        });
        current.custom_fields = {
            ...(current.custom_fields || {}),
            ...(contact.custom_fields || {})
        };
    });

    return Array.from(byPhone.values());
}

function parseStoredCustomFields(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(String(value || "{}"));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    } catch (error) {
        return {};
    }
}

function normalizeAccountContact(contact) {
    const phoneNumber = String(contact.wa_id || contact.phone_number || "").trim();
    if (!isValidStoredGroupNumber(phoneNumber)) return null;
    const groupNames = Array.isArray(contact.group_names)
        ? [...new Set(contact.group_names.map(name => String(name || "").trim()).filter(Boolean))]
        : [];

    return {
        phone_number: phoneNumber,
        name: String(contact.name || contact.profile_name || "").trim(),
        email: String(contact.email || "").trim(),
        city: String(contact.city || "").trim(),
        project_name: String(contact.project_name || "").trim(),
        custom_fields: parseStoredCustomFields(contact.custom_fields_json),
        group_names: groupNames
    };
}

async function loadExistingAccountContacts() {
    const container = document.getElementById("existingContactPickerList");
    if (container) {
        container.innerHTML = '<div class="group-empty-state">Loading account contacts...</div>';
    }

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/inbox/contacts?ts=" + Date.now(),
            {
                cache: "no-store",
                headers: { "Authorization": "Bearer " + token }
            }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load account contacts.");

        accountContacts = (data.contacts || [])
            .map(normalizeAccountContact)
            .filter(Boolean);
        accountContactsLoaded = true;
        renderExistingContactPicker(
            document.getElementById("existingContactSearch")?.value || ""
        );
    } catch (error) {
        accountContacts = [];
        accountContactsLoaded = false;
        if (container) {
            container.innerHTML = '<div class="group-empty-state">Unable to load account contacts.</div>';
        }
        updateExistingContactControls([]);
    }
}

function getFilteredAccountContacts(filterText) {
    const query = String(filterText || "").trim().toLowerCase();
    return accountContacts.filter(contact =>
        [
            contact.phone_number,
            contact.name,
            contact.email,
            contact.city,
            contact.project_name,
            ...(contact.group_names || [])
        ].join(" ").toLowerCase().includes(query)
    );
}

function getSavedGroupPhones() {
    return new Set(
        currentGroupMembers
            .map(member => String(member.phone_number || "").trim())
            .filter(isValidStoredGroupNumber)
    );
}

function getAvailableAccountContacts(filterText) {
    const savedPhones = getSavedGroupPhones();
    return getFilteredAccountContacts(filterText).filter(
        contact => !savedPhones.has(contact.phone_number)
    );
}

function updateExistingContactControls(filteredContacts) {
    const count = document.getElementById("selectedExistingContactsCount");
    const selectAllButton = document.getElementById("selectAllExistingContactsButton");
    const clearButton = document.getElementById("clearExistingContactsButton");
    const savedPhones = getSavedGroupPhones();
    const selectable = (filteredContacts || []).filter(
        contact => !savedPhones.has(contact.phone_number)
    );
    const allSelected = selectable.length > 0 && selectable.every(
        contact => selectedExistingContacts.has(contact.phone_number)
    );

    if (count) count.textContent = selectedExistingContacts.size + " selected";
    if (selectAllButton) {
        selectAllButton.disabled = !accountContactsLoaded || !selectable.length || allSelected;
    }
    if (clearButton) clearButton.disabled = selectedExistingContacts.size === 0;
}

function renderExistingContactPicker(filterText) {
    const container = document.getElementById("existingContactPickerList");
    if (!container) return;

    const filtered = getAvailableAccountContacts(filterText);
    updateExistingContactControls(filtered);

    if (!filtered.length) {
        const hasSearch = String(filterText || "").trim().length > 0;
        const message = hasSearch
            ? "No available contacts match your search."
            : accountContacts.length
                ? "All account contacts are already in this group."
                : "No account contacts are available.";
        container.innerHTML = '<div class="group-empty-state">' + message + '</div>';
        return;
    }

    container.innerHTML = filtered.map(contact => {
        const phone = contact.phone_number;
        const checked = selectedExistingContacts.has(phone);
        const secondary = [contact.city, contact.project_name].filter(Boolean).join(" · ");
        const groupLabel = contact.group_names.length
            ? contact.group_names.join(", ")
            : "No group";
        return `
            <label class="existing-contact-option">
                <input type="checkbox" data-existing-phone="${escapeHtml(phone)}"
                    ${checked ? "checked" : ""}>
                <span class="existing-contact-option-main">
                    <strong>${escapeHtml(contact.name || "Unnamed contact")}</strong>
                    <small>${escapeHtml(phone)}${secondary ? " · " + escapeHtml(secondary) : ""}</small>
                </span>
                <span class="existing-contact-option-status${contact.group_names.length ? " has-groups" : ""}"
                    title="${escapeHtml(groupLabel)}">${escapeHtml(groupLabel)}</span>
            </label>
        `;
    }).join("");

    container.querySelectorAll("input[data-existing-phone]").forEach(checkbox => {
        checkbox.addEventListener("change", function() {
            const phone = this.dataset.existingPhone;
            const contact = accountContacts.find(item => item.phone_number === phone);
            if (!contact) return;
            if (this.checked) selectedExistingContacts.set(phone, contact);
            else selectedExistingContacts.delete(phone);
            updateExistingContactControls(filtered);
        });
    });
}

function selectAllExistingContacts() {
    const filterText = document.getElementById("existingContactSearch")?.value || "";
    getAvailableAccountContacts(filterText).forEach(contact => {
        selectedExistingContacts.set(contact.phone_number, contact);
    });
    renderExistingContactPicker(filterText);
}

function clearExistingContacts() {
    selectedExistingContacts.clear();
    renderExistingContactPicker(
        document.getElementById("existingContactSearch")?.value || ""
    );
}

function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}

function downloadCsv(filename, headers, rows) {
    const content = "\uFEFF" + [
        headers.map(csvCell).join(","),
        ...rows.map(row => row.map(csvCell).join(","))
    ].join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function downloadCsvTemplate() {
    downloadCsv(
        "vbo-connect-contact-group-format.csv",
        ["Phone", "Name", "Email", "City", "Project Name", "Customer ID", "Other Info"],
        [["919876543210", "Amit Kumar", "amit@example.com", "Delhi", "Project Alpha", "C-1001", "Gold plan"]]
    );
}

function downloadCurrentGroupCsv() {
    const contacts = currentGroupMembers.filter(member =>
        isValidStoredGroupNumber(member.phone_number)
    );
    if (!contacts.length) {
        showThemeAlert("This group has no valid contacts to download.", {
            title: "Nothing to download",
            type: "info"
        });
        return;
    }

    const customKeys = Array.from(new Set(
        contacts.flatMap(member => Object.keys(member.custom_fields || {}))
    ));
    const headers = ["Phone", "Name", "Email", "City", "Project Name", ...customKeys];
    const rows = contacts.map(member => [
        member.phone_number,
        member.name || "",
        member.email || "",
        member.city || "",
        member.project_name || "",
        ...customKeys.map(key => member.custom_fields?.[key] ?? "")
    ]);
    const groupName = document.getElementById("groupEditorName")?.value || "contact-group";
    const safeName = groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "contact-group";
    downloadCsv(safeName + "-contacts.csv", headers, rows);
}

function renderGroupImportPreview() {
    const preview = document.getElementById("groupImportPreview");
    const summary = document.getElementById("groupImportSummary");
    const body = document.getElementById("groupImportPreviewBody");
    if (!preview || !summary || !body) return;

    preview.classList.remove("hidden");
    summary.className = "group-import-summary" +
        (groupImportInvalidRows.length ? " has-errors" : "");
    summary.textContent =
        groupImportRows.length + " valid unique contact(s) ready" +
        (groupImportInvalidRows.length
            ? "; " + groupImportInvalidRows.length + " invalid row(s) skipped."
            : ".");

    const validRows = groupImportRows.slice(0, 100).map(contact => {
        const extra = Object.entries(contact.custom_fields || {})
            .map(([key, value]) => key + ": " + value)
            .join("; ");
        return `
            <tr>
                <td>${escapeHtml(contact.phone_number)}</td>
                <td>${escapeHtml(contact.name || "-")}</td>
                <td>${escapeHtml(contact.email || "-")}</td>
                <td>${escapeHtml(contact.city || "-")}</td>
                <td>${escapeHtml(contact.project_name || "-")}</td>
                <td title="${escapeHtml(extra)}">${escapeHtml(extra || "-")}</td>
            </tr>
        `;
    });

    const invalidRows = groupImportInvalidRows.slice(0, 25).map(item => `
        <tr class="group-preview-invalid">
            <td>${escapeHtml(item.phone_number || "-")}</td>
            <td colspan="5">Row ${escapeHtml(item.row)}: ${escapeHtml(item.reason)}</td>
        </tr>
    `);

    body.innerHTML = [...validRows, ...invalidRows].join("") ||
        '<tr><td colspan="6">No contacts found in the supplied data.</td></tr>';
}

function prepareGroupImport() {
    const manualText = document.getElementById("groupManualContacts")?.value || "";
    const csvResult = parseContactImport(groupCsvText);
    const manualResult = parseContactImport(manualText);

    groupImportRows = mergeImportedContacts([
        ...selectedExistingContacts.values(),
        ...csvResult.valid,
        ...manualResult.valid
    ]);
    groupImportInvalidRows = [
        ...csvResult.invalid,
        ...manualResult.invalid
    ];

    renderGroupImportPreview();
    return groupImportRows;
}

function resetGroupImport() {
    groupCsvText = "";
    groupImportRows = [];
    groupImportInvalidRows = [];
    accountContacts = [];
    accountContactsLoaded = false;
    selectedExistingContacts = new Map();

    const fileInput = document.getElementById("groupCsvFile");
    const manualInput = document.getElementById("groupManualContacts");
    const preview = document.getElementById("groupImportPreview");
    const fileName = document.getElementById("groupImportFileName");
    const picker = document.getElementById("existingContactPickerList");
    const selectedCount = document.getElementById("selectedExistingContactsCount");
    const existingSearch = document.getElementById("existingContactSearch");
    const disclosure = document.getElementById("existingContactsDisclosure");
    const selectAllButton = document.getElementById("selectAllExistingContactsButton");
    const clearButton = document.getElementById("clearExistingContactsButton");
    if (fileInput) fileInput.value = "";
    if (manualInput) manualInput.value = "";
    if (preview) preview.classList.add("hidden");
    if (fileName) fileName.textContent = "No CSV selected";
    if (picker) picker.innerHTML = '<div class="group-empty-state">Expand this section to load account contacts.</div>';
    if (selectedCount) selectedCount.textContent = "0 selected";
    if (existingSearch) existingSearch.value = "";
    if (disclosure) disclosure.open = false;
    if (selectAllButton) selectAllButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
}

function openGroupEditor(mode) {
    groupEditorMode = mode;
    groupEditorId = null;
    currentGroupMembers = [];
    selectedGroupMemberIds = new Set();
    resetGroupImport();

    const modal = document.getElementById("groupEditorModal");
    const membersSection = document.getElementById("existingGroupMembersSection");
    const deleteButton = document.getElementById("deleteGroupButton");
    const title = document.getElementById("groupEditorTitle");
    const saveButton = document.getElementById("saveGroupButton");
    const nameInput = document.getElementById("groupEditorName");
    const descriptionInput = document.getElementById("groupEditorDescription");
    const memberSearch = document.getElementById("groupMemberSearch");

    if (nameInput) nameInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (memberSearch) memberSearch.value = "";
    updateGroupMemberSelectionControls([]);
    if (membersSection) membersSection.classList.toggle("hidden", mode !== "edit");
    if (deleteButton) deleteButton.classList.toggle("hidden", mode !== "edit");
    if (title) title.textContent = mode === "edit" ? "Manage Contact Group" : "Create Contact Group";
    if (saveButton) saveButton.textContent = mode === "edit" ? "Save Changes" : "Create Group";
    if (modal) modal.classList.remove("hidden");
    document.body.classList.add("group-editor-open");
    nameInput?.focus();
}

function closeGroupEditor() {
    document.getElementById("groupEditorModal")?.classList.add("hidden");
    document.body.classList.remove("group-editor-open");
}

function filterGroupMembers(filterText) {
    const query = String(filterText || "").trim().toLowerCase();
    return currentGroupMembers.filter(member => {
        const customText = Object.entries(member.custom_fields || {})
            .map(([key, value]) => key + " " + value)
            .join(" ");
        return [
            member.phone_number,
            member.name,
            member.email,
            member.city,
            member.project_name,
            customText
        ].join(" ").toLowerCase().includes(query);
    });
}

function updateGroupMemberSelectionControls(filteredMembers) {
    const selectAll = document.getElementById("selectAllGroupMembersCheckbox");
    const count = document.getElementById("selectedGroupMembersCount");
    const clearButton = document.getElementById("clearGroupMemberSelectionButton");
    const removeButton = document.getElementById("removeSelectedGroupMembersButton");
    const visibleIds = (filteredMembers || []).map(member => Number(member.id));
    const selectedVisible = visibleIds.filter(id => selectedGroupMemberIds.has(id)).length;

    if (selectAll) {
        selectAll.disabled = visibleIds.length === 0;
        selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
        selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    }
    if (count) count.textContent = selectedGroupMemberIds.size + " selected";
    if (clearButton) clearButton.disabled = selectedGroupMemberIds.size === 0;
    if (removeButton) removeButton.disabled = selectedGroupMemberIds.size === 0;
}

function renderExistingGroupMembers(filterText) {
    const container = document.getElementById("existingGroupMembers");
    const summary = document.getElementById("existingGroupMembersSummary");
    const downloadButton = document.getElementById("downloadGroupCsvButton");
    if (!container || !summary) return;

    const filtered = filterGroupMembers(filterText);

    const validCount = currentGroupMembers.filter(member =>
        isValidStoredGroupNumber(member.phone_number)
    ).length;
    const invalidCount = currentGroupMembers.length - validCount;
    if (downloadButton) downloadButton.disabled = validCount === 0;
    summary.textContent = validCount +
        (validCount === 1 ? " valid contact" : " valid contacts") +
        (invalidCount ? ", " + invalidCount + " invalid" : "");
    updateGroupMemberSelectionControls(filtered);

    if (!filtered.length) {
        container.innerHTML = '<div class="group-empty-state">No matching contacts.</div>';
        return;
    }

    container.innerHTML = filtered.map(member => {
        const isValid = isValidStoredGroupNumber(member.phone_number);
        const rawPhone = String(member.phone_number || "");
        const displayPhone = isValid || rawPhone.length <= 30
            ? rawPhone
            : rawPhone.slice(0, 18) + "... (" + rawPhone.length + " digits)";
        const extra = Object.entries(member.custom_fields || {})
            .map(([key, value]) => key + ": " + value)
            .join("; ");
        const memberId = Number(member.id);
        return `
            <div class="group-member-row${isValid ? "" : " group-member-row-invalid"}">
                <input type="checkbox" class="group-member-checkbox" data-group-member-id="${memberId}"
                    aria-label="Select ${escapeHtml(member.name || displayPhone)}"
                    ${selectedGroupMemberIds.has(memberId) ? "checked" : ""}>
                <div class="group-member-main">
                    <strong>${escapeHtml(isValid ? (member.name || "Unnamed contact") : "Invalid contact")}</strong>
                    <small>${escapeHtml(displayPhone)}</small>
                    ${isValid ? "" : '<span class="invalid-contact-badge">Will not be used for sending</span>'}
                </div>
                <div class="group-member-meta">
                    ${escapeHtml(member.email || "No email")}<br>
                    ${escapeHtml(member.city || "No city")}
                </div>
                <div class="group-member-extra">
                    ${escapeHtml(member.project_name || "No project")}
                    ${extra ? "<br>" + escapeHtml(extra) : ""}
                </div>
                <button type="button" class="group-member-remove" data-member-id="${memberId}">Remove</button>
            </div>
        `;
    }).join("");

    container.querySelectorAll(".group-member-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", function() {
            const memberId = Number(this.dataset.groupMemberId);
            if (this.checked) selectedGroupMemberIds.add(memberId);
            else selectedGroupMemberIds.delete(memberId);
            updateGroupMemberSelectionControls(filtered);
        });
    });

    container.querySelectorAll(".group-member-remove").forEach(button => {
        button.addEventListener("click", () => removeGroupMember(Number(button.dataset.memberId)));
    });
}

async function fetchContactGroupDetails(groupId) {
    const response = await fetch(
        API_BASE + "/whatsapp/contact-groups/" + groupId + "/details?ts=" + Date.now(),
        {
            cache: "no-store",
            headers: { "Authorization": "Bearer " + token }
        }
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Unable to load group.");
    }

    if (!data.group || !Array.isArray(data.members)) {
        throw new Error("The group response is incomplete. Please try again.");
    }

    return data;
}

async function loadGroupForEditor(groupId) {
    const data = await fetchContactGroupDetails(groupId);

    const group = data.group || {};
    groupEditorId = Number(groupId);
    currentGroupMembers = data.members || [];
    const availableMemberIds = new Set(currentGroupMembers.map(member => Number(member.id)));
    selectedGroupMemberIds = new Set(
        [...selectedGroupMemberIds].filter(memberId => availableMemberIds.has(memberId))
    );
    document.getElementById("groupEditorName").value = group.group_name || "";
    document.getElementById("groupEditorDescription").value = group.description || "";
    renderExistingGroupMembers(
        document.getElementById("groupMemberSearch")?.value || ""
    );
    if (accountContactsLoaded) {
        renderExistingContactPicker(
            document.getElementById("existingContactSearch")?.value || ""
        );
    }
}

function createGroup() {
    openGroupEditor("create");
}

async function manageGroup() {
    const groupId = document.getElementById("groupSelect")?.value;

    if (!groupId) {
        showStatus("Please select a group first.", "error");
        return;
    }

    openGroupEditor("edit");
    groupEditorId = Number(groupId);
    document.getElementById("existingGroupMembers").innerHTML =
        '<div class="group-empty-state">Loading contacts...</div>';

    try {
        await loadGroupForEditor(groupId);
    } catch (error) {
        console.error("MANAGE GROUP ERROR:", error);
        closeGroupEditor();
        showStatus(error.message || "Unable to load group.", "error");
    }
}

async function importMembersIntoGroup(groupId) {
    if (!groupImportRows.length) {
        return { added: 0, duplicates: 0, invalid_count: groupImportInvalidRows.length };
    }

    const response = await fetch(
        API_BASE + "/whatsapp/contact-groups/" + groupId + "/members/import",
        {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ members: groupImportRows })
        }
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Unable to import contacts.");
    }
    return data;
}

async function saveGroupEditor() {
    const name = document.getElementById("groupEditorName")?.value.trim() || "";
    const description = document.getElementById("groupEditorDescription")?.value.trim() || "";
    const manualText = document.getElementById("groupManualContacts")?.value.trim() || "";
    const hasImportSource = Boolean(
        groupCsvText.trim() ||
        manualText ||
        selectedExistingContacts.size
    );
    const saveButton = document.getElementById("saveGroupButton");
    let metadataSaved = false;

    if (!name) {
        await showThemeAlert("Please enter a group name.", {
            title: "Group name required",
            type: "info"
        });
        document.getElementById("groupEditorName")?.focus();
        return;
    }

    if (hasImportSource) {
        prepareGroupImport();
        if (!groupImportRows.length) {
            await showThemeAlert("No valid contacts were found. Please check the phone number column.", {
                title: "Contacts not found",
                type: "info"
            });
            return;
        }
        if (groupImportRows.length > 10000) {
            await showThemeAlert("Please import a maximum of 10,000 contacts at a time.", {
                title: "Import limit exceeded",
                type: "info"
            });
            return;
        }
    }

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        const isEdit = groupEditorMode === "edit";
        const response = await fetch(
            API_BASE + "/whatsapp/contact-groups" + (isEdit ? "/" + groupEditorId : ""),
            {
                method: isEdit ? "PUT" : "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ group_name: name, description })
            }
        );
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Unable to save group.");
        }

        const groupId = isEdit ? groupEditorId : data.group_id;
        metadataSaved = true;
        groupEditorId = Number(groupId);
        if (!isEdit) {
            groupEditorMode = "edit";
            document.getElementById("groupEditorTitle").textContent = "Manage Contact Group";
            document.getElementById("deleteGroupButton")?.classList.remove("hidden");
            document.getElementById("existingGroupMembersSection")?.classList.remove("hidden");
        }
        const importResult = await importMembersIntoGroup(groupId);

        await loadGroupForEditor(groupId);
        const persistedPhones = new Set(
            currentGroupMembers
                .map(member => String(member.phone_number || "").trim())
                .filter(isValidStoredGroupNumber)
        );
        const missingPhones = groupImportRows
            .map(contact => contact.phone_number)
            .filter(phone => !persistedPhones.has(phone));
        if (missingPhones.length) {
            throw new Error(
                missingPhones.length + " contact(s) could not be verified after saving."
            );
        }

        await loadGroups();
        const select = document.getElementById("groupSelect");
        if (select) select.value = String(groupId);
        setMode("group");
        updateCharge();
        closeGroupEditor();

        showStatus(
            (isEdit ? "Group updated." : "Group created.") +
            " " + Number(importResult.added || 0) + " contact(s) added" +
            (Number(importResult.duplicates || 0)
                ? ", " + Number(importResult.duplicates) + " existing contact(s) updated."
                : "."),
            "success"
        );
    } catch (error) {
        console.error("SAVE GROUP ERROR:", error);
        if (metadataSaved) {
            await loadGroups();
            await showThemeAlert(
                "The group was saved, but the contact update could not be verified. " +
                (error.message || "Please keep this window open and try again."),
                { title: "Verification failed", type: "danger" }
            );
        } else {
            await showThemeAlert(error.message || "Unable to save group.", {
                title: "Unable to save",
                type: "danger"
            });
        }
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = groupEditorMode === "edit" ? "Save Changes" : "Create Group";
        }
    }
}

function setAllVisibleGroupMembersSelected(shouldSelect) {
    const filtered = filterGroupMembers(
        document.getElementById("groupMemberSearch")?.value || ""
    );
    filtered.forEach(member => {
        const memberId = Number(member.id);
        if (shouldSelect) selectedGroupMemberIds.add(memberId);
        else selectedGroupMemberIds.delete(memberId);
    });
    renderExistingGroupMembers(
        document.getElementById("groupMemberSearch")?.value || ""
    );
}

function clearGroupMemberSelection() {
    selectedGroupMemberIds.clear();
    renderExistingGroupMembers(
        document.getElementById("groupMemberSearch")?.value || ""
    );
}

async function removeSelectedGroupMembers() {
    if (!groupEditorId || !selectedGroupMemberIds.size) return;

    const memberIds = [...selectedGroupMemberIds]
        .map(Number)
        .filter(Number.isInteger);
    const confirmed = await showThemeConfirm(
        "Remove " + memberIds.length + " selected contact(s) from this group? Master Contacts will remain safe.",
        {
            title: "Remove selected contacts?",
            type: "danger",
            confirmText: "Remove",
            cancelText: "Keep contacts"
        }
    );
    if (!confirmed) return;

    const removeButton = document.getElementById("removeSelectedGroupMembersButton");
    if (removeButton) {
        removeButton.disabled = true;
        removeButton.textContent = "Removing...";
    }

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/contact-groups/" + groupEditorId + "/members/delete",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ member_ids: memberIds })
            }
        );
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Unable to remove selected contacts.");
        }

        selectedGroupMemberIds.clear();
        await loadGroupForEditor(groupEditorId);
        await loadGroups();
        document.getElementById("groupSelect").value = String(groupEditorId);
        updateCharge();
        if (typeof window.vboToast === "function") {
            window.vboToast(Number(data.removed || 0) + " contact(s) removed from the group.", "success");
        }
    } catch (error) {
        await showThemeAlert(error.message || "Unable to remove selected contacts.", {
            title: "Removal failed",
            type: "danger"
        });
    } finally {
        if (removeButton) removeButton.textContent = "Remove Selected";
        updateGroupMemberSelectionControls(filterGroupMembers(
            document.getElementById("groupMemberSearch")?.value || ""
        ));
    }
}

async function removeGroupMember(memberId) {
    if (!groupEditorId) return;
    const confirmed = await showThemeConfirm(
        "Remove this contact from the group? Master Contacts will remain safe.",
        {
            title: "Remove contact?",
            type: "danger",
            confirmText: "Remove",
            cancelText: "Cancel"
        }
    );
    if (!confirmed) return;

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/contact-groups/" + groupEditorId + "/members/" + memberId,
            {
                method: "DELETE",
                headers: { "Authorization": "Bearer " + token }
            }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to remove contact.");

        await loadGroupForEditor(groupEditorId);
        await loadGroups();
        document.getElementById("groupSelect").value = String(groupEditorId);
        updateCharge();
    } catch (error) {
        await showThemeAlert(error.message || "Unable to remove contact.", {
            title: "Removal failed",
            type: "danger"
        });
    }
}

async function deleteCurrentGroup() {
    if (!groupEditorId) return;
    const confirmed = await showThemeConfirm(
        "Delete this group? Saved contacts will remain available in Contacts.",
        {
            title: "Delete contact group?",
            type: "danger",
            confirmText: "Delete Group",
            cancelText: "Cancel"
        }
    );
    if (!confirmed) return;

    try {
        const response = await fetch(
            API_BASE + "/whatsapp/contact-groups/" + groupEditorId,
            {
                method: "DELETE",
                headers: { "Authorization": "Bearer " + token }
            }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to delete group.");

        closeGroupEditor();
        await loadGroups();
        updateCharge();
        showStatus("Group deleted. Master contacts were preserved.", "success");
    } catch (error) {
        await showThemeAlert(error.message || "Unable to delete group.", {
            title: "Unable to delete group",
            type: "danger"
        });
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

        const value = await window.VBOUI.prompt(
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
    const data = await fetchContactGroupDetails(groupId);

    return (data.members || [])
        .map(member => String(member.phone_number || "").trim())
        .filter(isValidStoredGroupNumber);
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
    if (!await showThemeConfirm("Delete this upcoming schedule?", {
        title: "Delete schedule?",
        type: "danger",
        confirmText: "Delete",
        cancelText: "Cancel"
    })) return;

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

document
    .getElementById("prepareGroupImportButton")
    ?.addEventListener("click", prepareGroupImport);

document
    .getElementById("groupCsvFile")
    ?.addEventListener("change", async function(event) {
        const file = event.target.files?.[0];
        const fileName = document.getElementById("groupImportFileName");

        if (!file) {
            groupCsvText = "";
            if (fileName) fileName.textContent = "No CSV selected";
            prepareGroupImport();
            return;
        }

        try {
            groupCsvText = await file.text();
            if (fileName) fileName.textContent = file.name;
            prepareGroupImport();
        } catch (error) {
            groupCsvText = "";
            if (fileName) fileName.textContent = "Unable to read CSV";
            await showThemeAlert("Unable to read the selected CSV file.", {
                title: "CSV could not be read",
                type: "danger"
            });
        }
    });

document
    .getElementById("groupMemberSearch")
    ?.addEventListener("input", function(event) {
        renderExistingGroupMembers(event.target.value);
    });

document
    .getElementById("selectAllGroupMembersCheckbox")
    ?.addEventListener("change", function() {
        setAllVisibleGroupMembersSelected(this.checked);
    });

document
    .getElementById("clearGroupMemberSelectionButton")
    ?.addEventListener("click", clearGroupMemberSelection);

document
    .getElementById("removeSelectedGroupMembersButton")
    ?.addEventListener("click", removeSelectedGroupMembers);

document
    .getElementById("existingContactSearch")
    ?.addEventListener("input", function(event) {
        renderExistingContactPicker(event.target.value);
    });

document
    .getElementById("existingContactsDisclosure")
    ?.addEventListener("toggle", function() {
        if (this.open && !accountContactsLoaded) {
            loadExistingAccountContacts();
        }
    });

document
    .getElementById("selectAllExistingContactsButton")
    ?.addEventListener("click", selectAllExistingContacts);

document
    .getElementById("clearExistingContactsButton")
    ?.addEventListener("click", clearExistingContacts);

document
    .getElementById("downloadCsvTemplateButton")
    ?.addEventListener("click", downloadCsvTemplate);

document
    .getElementById("downloadGroupCsvButton")
    ?.addEventListener("click", downloadCurrentGroupCsv);

document
    .getElementById("saveGroupButton")
    ?.addEventListener("click", saveGroupEditor);

document
    .getElementById("deleteGroupButton")
    ?.addEventListener("click", deleteCurrentGroup);

[
    "closeGroupEditorButton",
    "cancelGroupEditorButton"
].forEach(id => {
    document.getElementById(id)?.addEventListener("click", closeGroupEditor);
});

document
    .getElementById("groupEditorModal")
    ?.addEventListener("click", function(event) {
        if (event.target === event.currentTarget) closeGroupEditor();
    });

document.addEventListener("keydown", function(event) {
    if (document.getElementById("vboDialogRoot")?.classList.contains("show")) return;
    if (event.key === "Escape" &&
        !document.getElementById("groupEditorModal")?.classList.contains("hidden")) {
        closeGroupEditor();
    }
});

setupModeButtons();
setupScheduleFields();
setupScheduleHistory();

loadClientInfo();
loadGroups();
loadTemplates();
