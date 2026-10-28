(() => {
    "use strict";

    const API = "https://app.vbo.co.in/api/v1";
    const token = localStorage.getItem("vbonotif_token");
    let currentFlow = null;
    let busy = false;
    let handoffTemplates = [];
    let handoffTemplatesLoaded = false;

    const el = id => document.getElementById(id);

    const guideButton = el("chatbotGuideButton");
    const guideModal = el("chatbotGuideModal");
    const guideClose = el("chatbotGuideClose");
    const guideDone = el("chatbotGuideDone");

    function closeChatbotGuide() {
        guideModal.hidden = true;
        guideButton.focus();
    }

    guideButton.addEventListener("click", () => {
        guideModal.hidden = false;
        guideClose.focus();
    });
    guideClose.addEventListener("click", closeChatbotGuide);
    guideDone.addEventListener("click", closeChatbotGuide);
    guideModal.addEventListener("click", event => {
        if (event.target === guideModal) {
            closeChatbotGuide();
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !guideModal.hidden) {
            closeChatbotGuide();
        }
    });

    function message(id, text, isError = false) {
        const node = el(id);
        if (node) {
            node.textContent = text;
            node.style.color = isError ? "#b42318" : "";
        }
    }

    async function api(path, options = {}) {
        const response = await fetch(API + path, {
            ...options,
            headers: {
                "Authorization": "Bearer " + token,
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {})
            }
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("vbonotif_token");
            localStorage.removeItem("vbonotif_client");
            window.location.href = "index.html";
            throw new Error("Session expired. Please log in again.");
        }

        if (!response.ok) {
            const detail = data.detail;
            const reason = Array.isArray(detail)
                ? detail.map(item => item.msg || JSON.stringify(item)).join("; ")
                : typeof detail === "string" ? detail : "Request failed.";
            throw new Error(reason);
        }

        return data;
    }

    function templateParameterCount(template) {
        const body = String(template.body_text || template.content || "");
        const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)]
            .map(match => Number(match[1]));
        return matches.length ? Math.max(...matches) : 0;
    }

    function renderHandoffTemplateOptions(selectedTemplateId) {
        const select = el("handoffTemplateSelect");
        select.replaceChildren();
        const fallback = new Option("No template \u2014 send normal text fallback", "");
        select.add(fallback);

        handoffTemplates.forEach(template => {
            const parameterCount = templateParameterCount(template);
            const option = new Option(
                `${template.template_name} (${template.language || "en_US"})` +
                (parameterCount > 1 ? " \u2014 needs more than one value" : ""),
                String(template.id)
            );
            option.disabled = parameterCount > 1;
            select.add(option);
        });

        const wanted = String(selectedTemplateId || "");
        select.value = [...select.options].some(option => !option.disabled && option.value === wanted)
            ? wanted : "";
        select.disabled = false;
        el("handoffTemplateHelp").textContent = handoffTemplates.length
            ? "Approved templates are loaded from this client. A template with {{1}} receives the customer number."
            : "No approved templates are available for this client. The normal-text fallback will be used.";
    }

    async function loadHandoffTemplates(selectedTemplateId) {
        const select = el("handoffTemplateSelect");
        select.disabled = true;
        select.replaceChildren(new Option("Loading approved templates\u2026", ""));
        try {
            const result = await api("/whatsapp/templates");
            handoffTemplates = (result.templates || []).filter(template =>
                String(template.status || "").toLowerCase() === "approved" &&
                Boolean(template.meta_template_id)
            );
            handoffTemplatesLoaded = true;
            renderHandoffTemplateOptions(selectedTemplateId);
        } catch (error) {
            handoffTemplates = [];
            handoffTemplatesLoaded = false;
            select.replaceChildren(new Option("Templates unavailable \u2014 use normal text fallback", ""));
            select.disabled = true;
            el("handoffTemplateHelp").textContent = "Templates could not be loaded. The normal-text fallback will be used.";
        }
    }

    async function loadAccount() {
        const data = await api("/auth/me");

        if (el("clientName")) {
            el("clientName").textContent = data.client_name || "Client";
        }
        
        // Check Dynamic Bot Access
        const features = data.features || {};
        const dynBot = features.dynamic_bot || {};
        let hasAccess = dynBot.enabled === true;
        
        if (hasAccess && dynBot.seamless !== true && dynBot.expires_at) {
            const expiry = new Date(dynBot.expires_at).getTime();
            if (Date.now() > expiry) {
                hasAccess = false;
            }
        }

        const apiBtn = el("addApiNode");
        if (apiBtn) {
            if (hasAccess) {
                apiBtn.style.display = "inline-block";
            } else {
                apiBtn.style.display = "inline-block";
                apiBtn.dataset.locked = "true";
                apiBtn.replaceWith(apiBtn.cloneNode(true)); // remove existing listeners
                el("addApiNode").addEventListener("click", function(e) {
                    e.preventDefault();
                    alert("Advanced API features locked hain. Dynamic Bot use karne ke liye Administrator se sampark karein.");
                });
            }
        }
        if (el("accountStatus")) {
            el("accountStatus").textContent = data.status || "Unknown";
        }

        const bot = data.bot || {};
        el("chatbotStatus").textContent =
            bot.enabled ? "Enabled" : "Disabled";
    }

    async function loadBotSettings() {
        const settings = await api("/whatsapp/bot/settings");
        el("botEnabledInput").checked = settings.enabled === true;
        el("botTimeoutInput").value = Math.round(
            Number(settings.session_timeout_seconds || 86400) / 60
        );
        el("handoffTimeoutInput").value = Math.round(
            Number(settings.handoff_timeout_seconds || 86400) / 60
        );
        el("chatbotStatus").textContent = settings.enabled
            ? "Enabled" : "Disabled";
        el("chatbotMode").textContent = settings.mode || "Not configured";
        return settings;
    }

    el("saveBotSettings").addEventListener("click", () =>
        runAction("saveBotSettings", async () => {
            const enabled = el("botEnabledInput").checked;
            const minutes = Number(el("botTimeoutInput").value);
            const handoffMinutes = Number(el("handoffTimeoutInput").value);
            if (!Number.isInteger(minutes) || minutes < 5 || minutes > 43200) {
                throw new Error("Session timeout must be between 5 minutes and 30 days.");
            }
            if (!Number.isInteger(handoffMinutes) || handoffMinutes < 5 || handoffMinutes > 43200) {
                throw new Error("Handoff timeout must be between 5 minutes and 30 days.");
            }
            const settings = await api("/whatsapp/bot/settings", {
                method: "PUT",
                body: JSON.stringify({
                    enabled,
                    mode: enabled ? "static" : null,
                    session_timeout_seconds: minutes * 60,
                    handoff_timeout_seconds: handoffMinutes * 60
                })
            });
            el("chatbotStatus").textContent = settings.enabled ? "Enabled" : "Disabled";
            el("chatbotMode").textContent = settings.mode || "Not configured";
            message("chatbotMessage", settings.enabled
                ? "Static chatbot enabled. Only the published flow will reply."
                : "Chatbot disabled. No automatic replies will be sent.");
        })
    );

    async function loadFlow(showMessage = true) {
        const documentData = await api("/whatsapp/bot/flow");
        currentFlow = documentData.draft || null;

        if (!currentFlow) {
            throw new Error("Backend did not return a draft flow.");
        }

        el("chatbotMode").textContent = currentFlow.mode || "Not configured";
        el("flowStatus").textContent = documentData.published
            ? "Published version available"
            : "Draft only";

        if (showMessage) {
            message("flowMessage", "Draft loaded successfully.");
        }

        return documentData;
    }

    async function runAction(buttonId, action) {
        if (busy) return;
        busy = true;
        const button = el(buttonId);
        if (button) button.disabled = true;

        try {
            await action();
        } catch (error) {
            message("flowMessage", error.message || "Something went wrong.", true);
        } finally {
            busy = false;
            if (button) button.disabled = false;
        }
    }

    el("loadFlowButton").addEventListener("click", () =>
        runAction("loadFlowButton", () => loadFlow())
    );

    let selectedNodeId = null;
    let connectSourceId = null;

    function editorMessage(text, isError = false) {
        message("flowEditorMessage", text, isError);
    }

    function ensureFlowShape() {
        if (!currentFlow || !Array.isArray(currentFlow.nodes) ||
            !Array.isArray(currentFlow.edges)) {
            throw new Error("Load a valid flow before editing.");
        }
        if (!currentFlow.nodes.some(node => node.type === "start")) {
            currentFlow.nodes.unshift({
                id: "start",
                type: "start",
                position: { x: 80, y: 80 },
                data: {}
            });
            currentFlow.start_node_id = "start";
        }
    }

    function nodeLabel(node) {
        if (["message", "question", "menu"].includes(node.type)) return node.data?.text || "(Prompt empty)";
        if (node.type === "start") return "Conversation starts here";
        if (node.type === "end") return "Conversation ends here";
        return node.type;
    }

    function renderFlowNodes() {
        const list = el("flowNodeList");
        list.replaceChildren();

        currentFlow.nodes.forEach((node, index) => {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "flow-node-card";
            card.classList.toggle("is-selected", node.id === selectedNodeId);
            card.textContent = `${index + 1}. ${node.type.toUpperCase()} \u2014 ${nodeLabel(node)}`;
            card.addEventListener("click", () => selectNode(node.id));
            list.appendChild(card);
        });

        const edgeHeading = document.createElement("p");
        edgeHeading.textContent = "Connections:";
        list.appendChild(edgeHeading);

        currentFlow.edges.forEach((edge, edgeIndex) => {
            const row = document.createElement("div");
            row.className = "flow-connection-row";

            const label = document.createElement("span");
            label.textContent = `${edge.source} \u2192 ${edge.target}`;
            row.appendChild(label);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", async () => {
                const confirmed = await window.VBOUI.confirm(
                    `Remove connection ${edge.source} \u2192 ${edge.target}?`
                );
                if (!confirmed) return;

                currentFlow.edges.splice(edgeIndex, 1);
                connectSourceId = null;
                renderFlowNodes();
                markFlowChanged();
                editorMessage("Connection removed. Save Draft when ready.");
            });

            row.appendChild(removeButton);
            list.appendChild(row);
        });
    }

    function selectNode(nodeId) {
        const node = currentFlow.nodes.find(item => item.id === nodeId);
        if (!node) return;

        selectedNodeId = nodeId;
        el("flowNodeEditor").hidden = false;
        el("selectedNodeTitle").textContent = "Edit node: " + node.id;
        el("selectedNodeType").value = node.type;
        el("selectedNodeText").value = node.data?.text || "";
        el("selectedNodeTextLabel").hidden = !["message", "question", "menu"].includes(node.type);
        el("selectedNodeOptionsLabel").hidden = node.type !== "menu";
        el("selectedNodeOptions").value = (node.data?.options || []).map(option =>
            `${option.label || option.value || "Option"}${option.target ? " | " + option.target : ""}`
        ).join("\n");
        const handoff = node.data?.handoff || node.data || {};
        el("selectedHandoffFields").hidden = node.type !== "handoff";
        el("selectedApiFields").hidden = node.type !== "api";
        if (node.type === "api") {
            const apiData = node.data || {};
            el("apiUrlInput").value = apiData.url || "";
            el("apiMethodSelect").value = apiData.method || "GET";
            el("apiHeadersInput").value = apiData.headers || "";
            el("apiBodyInput").value = apiData.body || "";
            el("apiParserInput").value = apiData.parser || "";
            el("apiActionInput").value = apiData.action || "";
        }
        if (node.type === "handoff") {
            const digits = String(handoff.employee_phone_number || "").replace(/\D/g, "");
            const knownCode = ["971", "91", "44", "1"].find(code => digits.startsWith(code));
            el("handoffCountryCode").value = knownCode || "91";
            el("handoffEmployeeNumber").value = knownCode ? digits.slice(knownCode.length) : digits;
            el("handoffCustomerConfirmation").value = handoff.customer_confirmation || "";
            if (handoffTemplatesLoaded) {
                renderHandoffTemplateOptions(handoff.employee_notification_template_id);
            } else {
                loadHandoffTemplates(handoff.employee_notification_template_id);
            }
        }
        renderFlowNodes();
    }

    function markFlowChanged() {
        el("flowStatus").textContent = "Unsaved local changes";
        el("chatbotMode").textContent = currentFlow.mode;
        editorMessage("Changes are local. Click Save Draft when ready.");
    }

    function addNode(type) {
        ensureFlowShape();
        const id = type + "_" + Date.now();
        const node = {
            id,
            type,
            position: { x: 120 + currentFlow.nodes.length * 30, y: 160 + currentFlow.nodes.length * 30 },
            data: ["message", "question", "menu"].includes(type)
                ? { text: type === "menu" ? "Choose an option" : "Write your message here", ...(type === "menu" ? { options: [] } : {}) }
                : type === "handoff" ? {
                    customer_confirmation: "Our team will contact you shortly."
                } : {}
        };
        currentFlow.nodes.push(node);
        selectNode(id);
        markFlowChanged();
    }

    el("openFlowBuilder").addEventListener("click", () => {
        if (!currentFlow) {
            message("flowMessage", "Load the flow first.", true);
            return;
        }

        try {
            ensureFlowShape();
            el("flowEditorPanel").hidden = false;
            el("openFlowBuilder").classList.add("is-open");
            el("flowNameInput").value = currentFlow.name || "Main flow";
            el("flowModeInput").value = currentFlow.mode || "static";
            renderFlowNodes();
            editorMessage("Editor ready. Add a message and an end node, then connect them.");
        } catch (error) {
            editorMessage(error.message, true);
        }
    });

    el("flowNameInput").addEventListener("change", () => {
        if (!currentFlow) return;
        currentFlow.name = el("flowNameInput").value.trim() || "Main flow";
        markFlowChanged();
    });

    el("flowModeInput").addEventListener("change", () => {
        if (!currentFlow) return;
        currentFlow.mode = el("flowModeInput").value;
        markFlowChanged();
    });

    el("addMessageNode").addEventListener("click", () => {
        try { addNode("message"); } catch (error) { editorMessage(error.message, true); }
    });

    el("addQuestionNode").addEventListener("click", () => {
        try { addNode("question"); } catch (error) { editorMessage(error.message, true); }
    });

    el("addMenuNode").addEventListener("click", () => {
        try { addNode("menu"); } catch (error) { editorMessage(error.message, true); }
    });

    el("addHandoffNode").addEventListener("click", () => {
        try { addNode("handoff"); } catch (error) { editorMessage(error.message, true); }
    });

    // API Node listener (will be checked against access in loadAccount)
    const apiBtnEl = el("addApiNode");
    if (apiBtnEl) {
        // Note: we don't attach the actual addNode here if no access. 
        // The access check in loadAccount will bind a toast alert if locked.
        // If unlocked, we need to add the actual addNode logic.
        apiBtnEl.addEventListener("click", function() {
             // Check if we already bound the alert (we can check a custom data attribute)
             if (apiBtnEl.dataset.locked === "true") return;
             try { addNode("api"); } catch (error) { editorMessage(error.message, true); }
        });
    }

    function setFlow(flow, notice) {
        currentFlow = flow;
        selectedNodeId = null;
        connectSourceId = null;
        el("flowEditorPanel").hidden = false;
        el("flowNameInput").value = flow.name;
        renderFlowNodes();
        markFlowChanged();
        editorMessage(notice);
    }

    el("startSimpleFlow").addEventListener("click", () => {
        try {
            ensureFlowShape();
            setFlow({
                schema_version: 1, name: "Welcome bot", mode: "static", start_node_id: "start",
                nodes: [
                    { id: "start", type: "start", position: { x: 80, y: 80 }, data: {} },
                    { id: "welcome", type: "message", position: { x: 220, y: 80 }, data: { text: "Hello! How can we help you today?" } },
                    { id: "end", type: "end", position: { x: 420, y: 80 }, data: {} }
                ],
                edges: [{ id: "start_welcome", source: "start", target: "welcome" }, { id: "welcome_end", source: "welcome", target: "end" }]
            }, "Simple welcome bot is ready. Click a step to change its text.");
        } catch (error) { editorMessage(error.message, true); }
    });

    el("startSupportFlow").addEventListener("click", () => {
        try {
            ensureFlowShape();
            setFlow({
                schema_version: 1, name: "Support bot", mode: "static", start_node_id: "start",
                nodes: [
                    { id: "start", type: "start", position: { x: 80, y: 80 }, data: {} },
                    { id: "menu", type: "menu", position: { x: 220, y: 80 }, data: { text: "Welcome! Reply 1 for information or 2 to talk to our team.", options: [{ id: "info", label: "Information", value: "1", target: "info_message" }, { id: "support", label: "Talk to support", value: "2", target: "handoff" }] } },
                    { id: "info_message", type: "message", position: { x: 440, y: 20 }, data: { text: "Please tell us what information you need." } },
                    { id: "handoff", type: "handoff", position: { x: 440, y: 150 }, data: { customer_confirmation: "Our team will contact you shortly." } },
                    { id: "end", type: "end", position: { x: 650, y: 20 }, data: {} }
                ],
                edges: [{ id: "start_menu", source: "start", target: "menu" }, { id: "info_end", source: "info_message", target: "end" }]
            }, "Support bot is ready. Open the HANDOFF step and enter the employee WhatsApp number before publishing.");
        } catch (error) { editorMessage(error.message, true); }
    });

    el("addEndNode").addEventListener("click", () => {
        try { addNode("end"); } catch (error) { editorMessage(error.message, true); }
    });

    el("connectFlowNodes").addEventListener("click", () => {
        if (!selectedNodeId) {
            editorMessage("Pehle source node select karo.", true);
            return;
        }

        if (!connectSourceId) {
            connectSourceId = selectedNodeId;
            editorMessage("Source: " + connectSourceId + ". Ab destination node select karke Connect dobara click karo.");
            return;
        }

        const sourceId = connectSourceId;
        const targetId = selectedNodeId;
        const sourceNode = currentFlow.nodes.find(node => node.id === sourceId);
        const targetNode = currentFlow.nodes.find(node => node.id === targetId);

        if (!sourceNode || !targetNode) {
            connectSourceId = null;
            editorMessage("Selected node nahi mila. Dobara select karo.", true);
            return;
        }

        if (sourceId === targetId) {
            connectSourceId = null;
            editorMessage("Source aur destination alag hone chahiye.", true);
            return;
        }

        if (sourceNode.type === "end" || sourceNode.type === "handoff") {
            connectSourceId = null;
            editorMessage("End/Handoff node se aage connection nahi bana sakte.", true);
            return;
        }

        if (targetNode.type === "start") {
            connectSourceId = null;
            editorMessage("Start node destination nahi ho sakta. Connection Start se aage banao.", true);
            return;
        }

        const exists = currentFlow.edges.some(edge =>
            edge.source === sourceId && edge.target === targetId
        );

        if (!exists) {
            currentFlow.edges.push({
                id: "edge_" + Date.now(),
                source: sourceId,
                target: targetId
            });
        }

        connectSourceId = null;
        renderFlowNodes();
        markFlowChanged();
        editorMessage("Connected: " + sourceId + " \u2192 " + targetId);
    });

    el("selectedNodeType").addEventListener("change", () => {
        el("selectedNodeTextLabel").hidden =
            !["message", "question", "menu"].includes(el("selectedNodeType").value);
        el("selectedNodeOptionsLabel").hidden =
            el("selectedNodeType").value !== "menu";
        el("selectedHandoffFields").hidden =
            el("selectedNodeType").value !== "handoff";
        el("selectedApiFields").hidden =
            el("selectedNodeType").value !== "api";
    });

    el("applyNodeChanges").addEventListener("click", () => {
        const node = currentFlow?.nodes.find(item => item.id === selectedNodeId);
        if (!node) {
            editorMessage("Select a node first.", true);
            return;
        }

        const newType = el("selectedNodeType").value;
        if (node.type === "start" && newType !== "start") {
            editorMessage("The Start node type cannot be changed.", true);
            return;
        }
        if (node.type !== "start" && newType === "start") {
            editorMessage("Only one Start node is allowed.", true);
            return;
        }

        node.type = newType;
        node.data = node.data || {};
        if (["message", "question", "menu"].includes(newType)) {
            node.data.text = el("selectedNodeText").value;
            if (newType === "menu") {
                node.data.options = el("selectedNodeOptions").value.split("\n")
                    .map(line => line.trim()).filter(Boolean).map((line, index) => {
                        const [label, target] = line.split("|").map(value => value.trim());
                        return { id: `option_${index + 1}`, label, value: label, ...(target ? { target } : {}) };
                    });
            } else {
                delete node.data.options;
            }
        } else {
            delete node.data.text;
            delete node.data.options;
        }
        if (newType === "api") {
            node.data = node.data || {};
            node.data.url = el("apiUrlInput").value.trim();
            node.data.method = el("apiMethodSelect").value;
            node.data.headers = el("apiHeadersInput").value.trim();
            node.data.body = el("apiBodyInput").value.trim();
            node.data.parser = el("apiParserInput").value.trim();
            node.data.action = el("apiActionInput").value.trim();
            delete node.data.text;
            delete node.data.options;
            delete node.data.employee_phone_number;
            delete node.data.customer_confirmation;
        } else if (newType === "handoff") {
            const country = el("handoffCountryCode").value;
            const localNumber = el("handoffEmployeeNumber").value.replace(/\D/g, "");
            if (!localNumber) {
                editorMessage("Enter the employee WhatsApp number before applying this handoff step.", true);
                return;
            }
            node.data.employee_phone_number = country + localNumber;
            const selectedTemplateId = Number(el("handoffTemplateSelect").value);
            if (Number.isInteger(selectedTemplateId) && selectedTemplateId > 0) {
                node.data.employee_notification_template_id = selectedTemplateId;
            } else {
                delete node.data.employee_notification_template_id;
            }
            node.data.customer_confirmation = el("handoffCustomerConfirmation").value.trim();
        } else {
            delete node.data.employee_phone_number;
            delete node.data.employee_notification_template_id;
            delete node.data.notification_message;
            delete node.data.customer_confirmation;
        }

        renderFlowNodes();
        selectNode(node.id);
        markFlowChanged();
    });

    el("deleteSelectedNode").addEventListener("click", () => {
        if (!selectedNodeId) return;
        const node = currentFlow.nodes.find(item => item.id === selectedNodeId);
        if (!node || node.type === "start") {
            editorMessage("The Start node cannot be deleted.", true);
            return;
        }

        currentFlow.nodes = currentFlow.nodes.filter(item => item.id !== selectedNodeId);
        currentFlow.edges = currentFlow.edges.filter(edge =>
            edge.source !== selectedNodeId && edge.target !== selectedNodeId
        );
        selectedNodeId = null;
        el("flowNodeEditor").hidden = true;
        renderFlowNodes();
        markFlowChanged();
    });

    el("saveDraftButton").addEventListener("click", () =>
        runAction("saveDraftButton", async () => {
            if (!currentFlow) throw new Error("Load a flow first.");
            const result = await api("/whatsapp/bot/flow/draft", {
                method: "PUT",
                body: JSON.stringify({ flow: currentFlow })
            });
            currentFlow = result.flow || currentFlow;
            message("flowMessage", "Draft saved successfully.");
            el("flowStatus").textContent = "Draft saved";
        })
    );

    el("validateFlowButton").addEventListener("click", () =>
        runAction("validateFlowButton", async () => {
            if (!currentFlow) throw new Error("Load a flow first.");
            const result = await api("/whatsapp/bot/flow/validate", {
                method: "POST",
                body: JSON.stringify({ flow: currentFlow })
            });

            if (result.valid) {
                message("flowMessage", "Validation passed. Flow is ready for publish checks.");
            } else {
                message("flowMessage",
                    "Validation errors:\n" + (result.errors || []).join("\n"), true);
            }
        })
    );

    el("publishFlowButton").addEventListener("click", () =>
        runAction("publishFlowButton", async () => {
            if (!currentFlow) throw new Error("Load a flow first.");
            if (!await window.VBOUI.confirm("Publish the saved draft?")) return;

            const result = await api("/whatsapp/bot/flow/publish", {
                method: "POST"
            });

            currentFlow = result.flow || currentFlow;
            await loadFlow(false);
            el("flowStatus").textContent = "Published";
            message("flowMessage", "Flow published successfully.");
        })
    );

    el("logoutButton").addEventListener("click", async () => {
        try {
            await fetch(API + "/auth/logout?token=" +
                encodeURIComponent(token), { method: "POST" });
        } catch (error) {
            console.error("Logout error:", error);
        }

        localStorage.removeItem("vbonotif_token");
        localStorage.removeItem("vbonotif_client");
        window.location.href = "index.html";
    });

    async function init() {
        if (!token) {
            window.location.href = "index.html";
            return;
        }

        try {
            await loadAccount();
            await loadBotSettings();
            await loadFlow(false);
            message("chatbotMessage", "Chatbot configuration loaded.");
        } catch (error) {
            message("chatbotMessage",
                "Could not load configuration: " + error.message, true);
        }
    }

    init();
})();



