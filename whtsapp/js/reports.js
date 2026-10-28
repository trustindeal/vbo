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
    const fields = [
        "message_row_id", "created_at", "recipient", "message_type",
        "delivery_status", "billing_label", "charge_amount_report",
        "refunded_amount_report", "net_amount", "error_code",
        "error_title", "error_message", "message_text"
    ];
    let currentRows = [];

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
            return {
                "&": "&amp;", "<": "&lt;", ">": "&gt;",
                '"': "&quot;", "'": "&#39;"
            }[ch];
        });
    }

    function money(value) {
        return value === null || value === undefined || value === ""
            ? "—" : Number(value).toFixed(2);
    }

    function currentFilters() {
        const params = new URLSearchParams();
        const mapping = {
            start_date: "startDate",
            end_date: "endDate",
            status: "deliveryStatus",
            billing_status: "billingStatus",
            message_type: "messageType"
        };
        Object.keys(mapping).forEach(function (key) {
            const value = $(mapping[key]).value.trim();
            if (value) params.set(key, value);
        });
        return params;
    }

    function showNotice(message, isError) {
        const notice = $("reportNotice");
        notice.textContent = message;
        notice.className = "report-notice" + (isError ? " error" : "");
    }

    function renderSummary(summary) {
        $("totalMessages").textContent = summary.total_messages ?? 0;
        $("totalCharges").textContent = "₹" + money(summary.total_charges);
        $("totalRefunds").textContent = "₹" + money(summary.total_refunds);
        $("netSpending").textContent = "₹" + money(summary.net_spending);
        $("unrecordedCount").textContent = summary.unrecorded_count ?? 0;
    }

    function renderRows(rows) {
        const tbody = $("reportRows");
        tbody.replaceChildren();

        if (!rows.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 10;
            td.className = "table-message";
            td.textContent = "No messages match these filters.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        rows.forEach(function (row) {
            const tr = document.createElement("tr");
            const errorText = [row.error_code, row.error_title, row.error_message]
                .filter(Boolean).join(" — ");

            const values = [
                row.created_at || "",
                row.recipient || "",
                row.message_type || "",
                row.delivery_status || "",
                row.billing_label || "Unrecorded / Verify",
                money(row.charge_amount_report),
                money(row.refunded_amount_report),
                money(row.net_amount),
                errorText || "—",
                row.message_text || ""
            ];

            values.forEach(function (value, index) {
                const td = document.createElement("td");
                td.textContent = value;
                if (index === 8 || index === 9) td.className = "long-cell";
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    async function loadReports() {
        $("applyFilters").disabled = true;
        $("exportCsv").disabled = true;
        $("exportXlsx").disabled = true;
        showNotice("Loading report...", false);

        try {
            const response = await fetch(endpoint + "?" + currentFilters().toString(), {
                headers: { "Authorization": "Bearer " + token }
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Unable to load reports.");
            }

            currentRows = Array.isArray(data.messages) ? data.messages : [];
            renderSummary(data.summary || {});
            renderRows(currentRows);
            $("resultCount").textContent = currentRows.length + " message(s)";
            $("exportCsv").disabled = currentRows.length === 0;
            $("exportXlsx").disabled = currentRows.length === 0;
            showNotice("Report loaded successfully.", false);
        } catch (error) {
            currentRows = [];
            renderSummary({});
            renderRows([]);
            $("resultCount").textContent = "Report unavailable";
            showNotice(error.message || "Unable to load report.", true);
            console.error("REPORT LOAD ERROR:", error);
        } finally {
            $("applyFilters").disabled = false;
        }
    }

    function exportColumns() {
        return [
            ["Message ID", "message_row_id"],
            ["Created At", "created_at"],
            ["Recipient", "recipient"],
            ["Message Type", "message_type"],
            ["Delivery Status", "delivery_status"],
            ["Billing Status", "billing_label"],
            ["Charge (INR)", "charge_amount_report"],
            ["Refund (INR)", "refunded_amount_report"],
            ["Net (INR)", "net_amount"],
            ["Meta Error Code", "error_code"],
            ["Meta Error Title", "error_title"],
            ["Meta Error Message", "error_message"],
            ["Message", "message_text"]
        ];
    }

    function safeCsvCell(value) {
        let text = String(value == null ? "" : value);
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function exportCsv() {
        const columns = exportColumns();
        const lines = [columns.map(function (col) {
            return safeCsvCell(col[0]);
        }).join(",")];

        currentRows.forEach(function (row) {
            lines.push(columns.map(function (col) {
                return safeCsvCell(row[col[1]]);
            }).join(","));
        });

        downloadBlob(
            new Blob(["\uFEFF" + lines.join("\r\n")], {
                type: "text/csv;charset=utf-8;"
            }),
            "vbonotif-message-report.csv"
        );
    }

    async function exportXlsx() {
        const button = $("exportXlsx");
        button.disabled = true;
        showNotice("Preparing Excel file...", false);

        try {
            const params = currentFilters();
            params.set("format", "xlsx");
            const response = await fetch(
                API_BASE + "/whatsapp/reports/messages/export?" + params.toString(),
                { headers: { "Authorization": "Bearer " + token } }
            );

            if (!response.ok) {
                let message = "Excel export failed.";
                try {
                    const data = await response.json();
                    message = data.detail || message;
                } catch (_) {}
                throw new Error(message);
            }

            const blob = await response.blob();
            downloadBlob(blob, "vbonotif-message-report.xlsx");
            showNotice("Excel file downloaded.", false);
        } catch (error) {
            showNotice(error.message || "Excel export failed.", true);
            console.error("REPORT EXCEL EXPORT ERROR:", error);
        } finally {
            button.disabled = currentRows.length === 0;
        }
    }

    $("applyFilters").addEventListener("click", loadReports);
    $("resetFilters").addEventListener("click", function () {
        ["startDate", "endDate", "deliveryStatus", "billingStatus", "messageType"]
            .forEach(function (id) { $(id).value = ""; });
        loadReports();
    });
    $("exportCsv").addEventListener("click", exportCsv);
    $("exportXlsx").addEventListener("click", exportXlsx);

    loadReports();
})();