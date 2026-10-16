(function () {
    "use strict";
    const token = localStorage.getItem("vbonotif_token");
    const button = document.getElementById("loadMetaEventsButton");
    const status = document.getElementById("metaEventsStatus");
    const body = document.getElementById("metaEventsBody");
    if (!button || !status || !body) return;

    function cell(value) {
        const td = document.createElement("td");
        td.textContent = value == null || value === "" ? "—" : String(value);
        return td;
    }

    button.addEventListener("click", async function () {
        button.disabled = true;
        status.textContent = "Loading events...";
        try {
            const response = await fetch(
                "https://app.vbo.co.in/api/v1/whatsapp/meta-events?limit=100",
                { headers: { "Authorization": "Bearer " + token, "Accept": "application/json" } }
            );
            const data = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(data.detail || ("HTTP " + response.status));

            body.replaceChildren();
            const events = Array.isArray(data.events) ? data.events : [];
            if (!events.length) {
                const row = document.createElement("tr");
                const td = cell("No recorded Meta events yet.");
                td.colSpan = 6;
                row.appendChild(td);
                body.appendChild(row);
            } else {
                events.forEach(function (event) {
                    const row = document.createElement("tr");
                    row.append(
                        cell(event.created_at),
                        cell(event.event_type),
                        cell(event.status),
                        cell(event.message_id),
                        cell(event.error_code),
                        cell([event.error_title, event.error_message].filter(Boolean).join(": "))
                    );
                    body.appendChild(row);
                });
            }
            status.textContent = "Loaded " + events.length + " event(s).";
        } catch (error) {
            status.textContent = "Could not load events: " + (error.message || "Network error");
        } finally {
            button.disabled = false;
        }
    });
})();