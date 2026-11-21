(function () {
    "use strict";

    const token = localStorage.getItem("vbonotif_token");
    const API_BASE = "https://app.vbo.co.in/api/v1";
    const endpoint = API_BASE + "/whatsapp/reports/messages";

    if (!token) {
        window.location.href = "index.html";
        return;
    }

    const $ = (id) => document.getElementById(id);
    let currentRows = [];
    let currentPage = 1;
    let currentPagination = {page: 1, page_size: 50, total_records: 0, total_pages: 1};
    let detailRow = null;

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
            return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch];
        });
    }

    function money(value) {
        return value === null || value === undefined || value === ""
            ? "—" : Number(value).toFixed(2);
    }

    function labelize(value) {
        return String(value || "Unknown").replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
    }

    function currentFilters(includePagination) {
        const params = new URLSearchParams();
        const mapping = {
            scope: "reportScope",
            start_date: "startDate",
            end_date: "endDate",
            status: "deliveryStatus",
            billing_status: "billingStatus",
            message_type: "messageType",
            search: "reportSearch"
        };
        Object.keys(mapping).forEach(function (key) {
            const value = $(mapping[key]).value.trim();
            if (value) params.set(key, value);
        });
        if (includePagination) {
            params.set("page", String(currentPage));
            params.set("page_size", $("pageSize").value);
        }
        return params;
    }

    function showNotice(message, isError) {
        const notice = $("reportNotice");
        notice.textContent = message;
        notice.className = "report-notice" + (isError ? " error" : "");
    }

    function updateScopeUi() {
        const received = $("reportScope").value === "received";
        $("billingStatus").disabled = received;
        if (received) $("billingStatus").value = "";
        $("totalRecordsLabel").textContent = received ? "Received messages" : "Financial records";
        $("reportDetailsTitle").textContent = received
            ? "Received message details"
            : "Sent message & billing details";
        document.body.classList.toggle("received-report", received);
    }

    function renderSummary(summary) {
        const deleted = Number(summary.deleted_record_count || 0);
        const verify = Number(summary.unrecorded_count || 0);
        $("totalMessages").textContent = Number(summary.total_records ?? summary.total_messages ?? 0).toLocaleString("en-IN");
        $("totalCharges").textContent = "₹" + money(summary.total_charges);
        $("totalRefunds").textContent = "₹" + money(summary.total_refunds);
        $("netSpending").textContent = "₹" + money(summary.net_spending);
        $("unrecordedCount").textContent = `${verify} / ${deleted}`;
        $("auditHint").textContent = "Verify / deleted records retained";
    }

    function statusClass(value) {
        const key = String(value || "unknown").toLowerCase();
        if (["read", "delivered", "charged", "received"].includes(key)) return "success";
        if (["failed", "rejected", "refunded"].includes(key)) return "danger";
        if (["pending", "pending charge", "sent", "unrecorded / verify"].includes(key)) return "warning";
        if (key === "record deleted") return "muted";
        return "neutral";
    }

    function renderRows(rows) {
        const tbody = $("reportRows");
        tbody.replaceChildren();

        if (!rows.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 10;
            td.className = "table-message";
            td.textContent = "No records match these filters.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        rows.forEach(function (row, rowIndex) {
            const tr = document.createElement("tr");
            tr.className = Number(row.record_deleted || 0) === 1 ? "deleted-report-row" : "";
            const recipient = row.recipient || "Deleted contact";
            const contactName = row.contact_name || "";
            const previewBase = row.message_preview || row.message_text || "No message text";
            const preview = previewBase + (String(row.message_text || "").replace(/\s+/g, " ").length > 40 ? "…" : "");
            const errorText = [row.error_code, row.error_title].filter(Boolean).join(" — ");

            tr.innerHTML = `
                <td class="date-cell">${escapeHtml(row.created_at || "—")}</td>
                <td class="recipient-cell">
                    <strong>${escapeHtml(contactName || recipient)}</strong>
                    ${contactName && recipient ? `<small>${escapeHtml(recipient)}</small>` : ""}
                </td>
                <td><span class="type-chip">${escapeHtml(labelize(row.message_type))}</span></td>
                <td><span class="status-chip ${statusClass(row.delivery_status)}">${escapeHtml(labelize(row.delivery_status))}</span></td>
                <td><span class="status-chip ${statusClass(row.billing_label)}">${escapeHtml(row.billing_label || "—")}</span></td>
                <td class="money-cell">${escapeHtml(money(row.charge_amount_report))}</td>
                <td class="money-cell">${escapeHtml(money(row.refunded_amount_report))}</td>
                <td class="money-cell">${escapeHtml(money(row.net_amount))}</td>
                <td class="error-cell" title="${escapeHtml([row.error_code, row.error_title, row.error_message].filter(Boolean).join(" — "))}">${escapeHtml(errorText || "—")}</td>
                <td class="message-cell">
                    <button type="button" class="message-preview-button" data-report-row="${rowIndex}"
                        title="${escapeHtml(row.message_text || "No message text")}">${escapeHtml(preview)}</button>
                </td>`;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll(".message-preview-button").forEach(button => {
            button.addEventListener("click", () => openDetails(currentRows[Number(button.dataset.reportRow)]));
        });
    }

    function renderPagination(pagination) {
        currentPagination = pagination || currentPagination;
        const total = Number(currentPagination.total_records || 0);
        const page = Number(currentPagination.page || 1);
        const pageSize = Number(currentPagination.page_size || 50);
        const totalPages = Math.max(1, Number(currentPagination.total_pages || 1));
        const start = total ? ((page - 1) * pageSize) + 1 : 0;
        const end = Math.min(page * pageSize, total);
        $("reportPagination").hidden = total === 0;
        $("pageRange").textContent = `${start.toLocaleString("en-IN")}–${end.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}`;
        $("pageLabel").textContent = `Page ${page} of ${totalPages}`;
        $("previousPage").disabled = page <= 1;
        $("nextPage").disabled = page >= totalPages;
        $("resultCount").textContent = `${total.toLocaleString("en-IN")} record${total === 1 ? "" : "s"}`;
    }

    async function loadReports(resetPage) {
        if (resetPage) currentPage = 1;
        $("applyFilters").disabled = true;
        $("exportCsv").disabled = true;
        $("exportXlsx").disabled = true;
        showNotice("Loading report…", false);

        try {
            const response = await fetch(endpoint + "?" + currentFilters(true).toString(), {
                headers: {"Authorization": "Bearer " + token}
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Unable to load reports.");

            currentRows = Array.isArray(data.messages) ? data.messages : [];
            renderSummary(data.summary || {});
            renderRows(currentRows);
            renderPagination(data.pagination || {});
            const total = Number(data.summary?.total_records || 0);
            $("exportCsv").disabled = total === 0;
            $("exportXlsx").disabled = total === 0;
            const retained = Number(data.summary?.deleted_record_count || 0);
            showNotice(
                $("reportScope").value === "sent"
                    ? `Financial totals reconciled from billing ledger.${retained ? ` ${retained} deleted-message billing records retained.` : ""}`
                    : "Received message activity loaded successfully.",
                false
            );
        } catch (error) {
            currentRows = [];
            renderSummary({});
            renderRows([]);
            renderPagination({page: 1, page_size: Number($("pageSize").value), total_records: 0, total_pages: 1});
            $("resultCount").textContent = "Report unavailable";
            showNotice(error.message || "Unable to load report.", true);
            console.error("REPORT LOAD ERROR:", error);
        } finally {
            $("applyFilters").disabled = false;
        }
    }

    function openDetails(row) {
        if (!row) return;
        detailRow = row;
        $("reportDetailSubtitle").textContent = `${row.created_at || "Unknown date"} • ${row.recipient || "Deleted contact"}`;
        const fields = [
            ["Record ID", row.message_row_id || "—"],
            ["Contact", row.contact_name || "—"],
            ["Recipient", row.recipient || "Deleted contact"],
            ["Type", labelize(row.message_type)],
            ["Template", row.template_name || "—"],
            ["Delivery", labelize(row.delivery_status)],
            ["Billing", row.billing_label || "—"],
            ["Charge", money(row.charge_amount_report) === "—" ? "—" : "₹" + money(row.charge_amount_report)],
            ["Refund", money(row.refunded_amount_report) === "—" ? "—" : "₹" + money(row.refunded_amount_report)],
            ["Net", money(row.net_amount) === "—" ? "—" : "₹" + money(row.net_amount)],
            ["Source", row.message_source || "—"],
            ["Meta ID", row.meta_message_id || "—"],
            ["Meta error", [row.error_code, row.error_title, row.error_message].filter(Boolean).join(" — ") || "—"]
        ];
        $("reportDetailMeta").innerHTML = fields.map(([label, value]) =>
            `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
        ).join("");
        $("reportDetailMessage").textContent = row.message_text || "No message text";
        $("reportDetailModal").classList.remove("hidden");
        document.body.classList.add("report-modal-open");
    }

    function closeDetails() {
        detailRow = null;
        $("reportDetailModal").classList.add("hidden");
        document.body.classList.remove("report-modal-open");
    }

    async function copyDetailMessage() {
        if (!detailRow) return;
        const text = detailRow.message_text || "";
        try {
            await navigator.clipboard.writeText(text);
            if (typeof window.vboToast === "function") window.vboToast("Message copied.", "success");
        } catch (_) {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
        }
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function exportReport(format) {
        const button = format === "xlsx" ? $("exportXlsx") : $("exportCsv");
        button.disabled = true;
        showNotice(`Preparing ${format.toUpperCase()} export…`, false);
        try {
            const params = currentFilters(false);
            params.set("format", format);
            const response = await fetch(endpoint + "/export?" + params.toString(), {
                headers: {"Authorization": "Bearer " + token}
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || "Export failed.");
            }
            downloadBlob(await response.blob(), `vbo-connect-${$("reportScope").value}-report.${format}`);
            showNotice(`${format.toUpperCase()} file downloaded.`, false);
        } catch (error) {
            showNotice(error.message || "Export failed.", true);
        } finally {
            button.disabled = Number(currentPagination.total_records || 0) === 0;
        }
    }

    $("applyFilters").addEventListener("click", () => loadReports(true));
    $("resetFilters").addEventListener("click", function () {
        ["startDate", "endDate", "deliveryStatus", "billingStatus", "messageType", "reportSearch"]
            .forEach(id => { $(id).value = ""; });
        $("reportScope").value = "sent";
        $("pageSize").value = "50";
        updateScopeUi();
        loadReports(true);
    });
    $("reportScope").addEventListener("change", function () {
        updateScopeUi();
        loadReports(true);
    });
    $("pageSize").addEventListener("change", () => loadReports(true));
    $("reportSearch").addEventListener("keydown", event => {
        if (event.key === "Enter") loadReports(true);
    });
    $("previousPage").addEventListener("click", function () {
        if (currentPage <= 1) return;
        currentPage -= 1;
        loadReports(false);
    });
    $("nextPage").addEventListener("click", function () {
        if (currentPage >= Number(currentPagination.total_pages || 1)) return;
        currentPage += 1;
        loadReports(false);
    });
    $("exportCsv").addEventListener("click", () => exportReport("csv"));
    $("exportXlsx").addEventListener("click", () => exportReport("xlsx"));
    $("closeReportDetail").addEventListener("click", closeDetails);
    $("closeReportDetailFooter").addEventListener("click", closeDetails);
    $("copyReportMessage").addEventListener("click", copyDetailMessage);
    $("reportDetailModal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeDetails();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("reportDetailModal").classList.contains("hidden")) closeDetails();
    });

    updateScopeUi();
    loadReports(true);
})();
