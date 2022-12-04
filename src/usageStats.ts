/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as fetchH2 from 'fetch-h2';
import * as userLogin from "./userLogin";


let _global_last_useful_result_ts = 0;


export function get_global_last_useful_result_ts() {
    return _global_last_useful_result_ts;
}


export async function report_success_or_failure(
    positive: boolean,
    scope: string,
    related_url: string,
    error_message: string | any,
    model_name: string | undefined,
) {
    if (typeof error_message !== "string") {
        error_message = JSON.stringify(error_message);
    }
    if (error_message.length > 200) {
        error_message = error_message.substring(0, 200) + "…";
    }
    if (model_name) {
        global.menu.model_worked(model_name);
    }
    global.menu.statusbarSocketError(!positive, `${error_message}`);
    if (positive) {
        _global_last_useful_result_ts = Date.now();
        global.panelProvider.login_success();
    } else {
        global.panelProvider.logout_success();
    }
    let msg = `${positive ? "1" : "0"} ${scope} ${related_url} "${error_message}"`;
    // Typical msg:
    // 1 CompletionProvider https://inference.smallcloud.ai/v1/contrast ""
    // 0 CompletionProvider https://inference.smallcloud.ai/v1/contrast "Could not verify your API key (3)"
    console.log([msg]);
    let global_context: vscode.ExtensionContext|undefined = global.global_context;
    if (global_context !== undefined) {
        let count_msg: { [key: string]: number } | undefined = await global_context.globalState.get("usage_stats");
        if (typeof count_msg !== "object") {
            count_msg = {};
        }
        if (count_msg[msg] === undefined) {
            count_msg[msg] = 1;
        } else {
            count_msg[msg] += 1;
        }
        await global_context.globalState.update(
            "usage_stats",
            count_msg
        );
    }
}


export async function report_usage_stats()
{
    let global_context: vscode.ExtensionContext|undefined = global.global_context;
    if (global_context === undefined) {
        return;
    }
    let count_msg: { [key: string]: number } | undefined = await global_context.globalState.get("usage_stats");
    if (count_msg === undefined) {
        return;
    }
    let usage = "";
    for (let key in count_msg) {
        usage += `${key} ${count_msg[key]}\n`;
    }
    const apiKey = userLogin.getApiKey();
    if (!apiKey) {
        return;
    }
    let client_version = vscode.extensions.getExtension("smallcloud.codify")!.packageJSON.version;
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
    };
    let url = "https://www.smallcloud.ai/v1/usage-stats";
    let response = await fetchH2.fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
            "client_version": `vscode-${client_version}`,
            "usage": usage,
        }),
    });
    if (response.status !== 200) {
        console.log([response.status, url]);
        return;
    }
    await global_context.globalState.update("report_usage_stats", {});
}
