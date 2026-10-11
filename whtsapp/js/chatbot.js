(() => {
    "use strict";

    const API = "https://app.vbo.co.in/api/v1";
    const token = localStorage.getItem("vbonotif_token");
    let currentFlow = null;
    let busy = false;

    const el = id => document.getElementById(id);

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

    async function loadAccount() {
        const data = await api("/auth/me");

        if (el("clientName")) {
            el("clientName").textContent = data.client_name || "Client";
        }
        if (el("accountStatus")) {
            el("accountStatus").textContent = data.status || "Unknown";
        }

        const bot = data.bot || {};
        el("chatbotStatus").textContent =
            bot.enabled ? "Enabled" : "Disabled";
    }

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
        if (node.type === "message") return node.data?.text || "(Message text empty)";
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
            card.className = "quick-action";
            card.style.display = "block";
            card.style.width = "100%";
            card.style.margin = "8px 0";
            card.style.textAlign = "left";
            card.style.border = node.id === selectedNodeId
                ? "2px solid #20c969" : "1px solid #d1d5db";
            card.textContent = `${index + 1}. ${node.type.toUpperCase()} — ${nodeLabel(node)}`;
            card.addEventListener("click", () => selectNode(node.id));
            list.appendChild(card);
        });

        const edgeHeading = document.createElement("p");
        edgeHeading.textContent = "Connections:";
        list.appendChild(edgeHeading);

        currentFlow.edges.forEach((edge, edgeIndex) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.justifyContent = "space-between";
            row.style.gap = "8px";
            row.style.margin = "6px 0";

            const label = document.createElement("span");
            label.textContent = `${edge.source} → ${edge.target}`;
            row.appendChild(label);

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => {
                const confirmed = window.confirm(
                    `Remove connection ${edge.source} → ${edge.target}?`
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
        el("selectedNodeTextLabel").hidden = !["message"].includes(node.type);
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
            data: type === "message" ? { text: "Write your message here" } : {}
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
        editorMessage("Connected: " + sourceId + " → " + targetId);
    });

    el("selectedNodeType").addEventListener("change", () => {
        el("selectedNodeTextLabel").hidden =
            el("selectedNodeType").value !== "message";
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
        if (newType === "message") {
            node.data.text = el("selectedNodeText").value;
        } else {
            delete node.data.text;
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
            if (!window.confirm("Publish the saved draft?")) return;

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
            await loadFlow(false);
            message("chatbotMessage", "Chatbot configuration loaded.");
        } catch (error) {
            message("chatbotMessage",
                "Could not load configuration: " + error.message, true);
        }
    }

    init();
})();



