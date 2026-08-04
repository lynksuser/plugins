import { findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

import {
    diag,
    gatewayDiag,
    hiddenIds,
    isHidden,
    originals,
    setHidden,
} from "./hidden";
import { filePathStats, matchingPaths, pathsUnder } from "./debug";

const { FormSection, FormSwitchRow, FormText, FormDivider, FormRow } = Forms;

const ChannelStore = findByStoreName("ChannelStore");
const UserStore = findByStoreName("UserStore");

const GROUP_DM = 3;

function channelLabel(channel: any): string {
    if (channel.name) return channel.name;

    const names = (channel.recipients ?? [])
        .map((id: string) => UserStore?.getUser?.(id)?.username)
        .filter(Boolean);

    return names.length ? names.join(", ") : "Unnamed group";
}

// Reads getMutablePrivateChannels (which we never patch) first, falling back to
// the pre-patch handle index.ts captured. Using a patched function here would
// hide groups from their own toggle and make them impossible to unhide.
function getGroupDMs(): any[] {
    const mutable = ChannelStore?.getMutablePrivateChannels?.();
    const list = mutable
        ? Object.values(mutable)
        : originals["ChannelStore.getSortedPrivateChannels"]?.() ?? [];

    return (list as any[])
        .filter((c) => c?.type === GROUP_DM)
        .sort((a, b) => channelLabel(a).localeCompare(channelLabel(b)));
}

function Diagnostics() {
    const patched = diag.patched;

    return (
        <>
            {/* These two must render even when nothing was patched — they are how
                we diagnose the nothing-was-patched case in the first place. */}
            <FormRow
                label="Hidden ids in storage"
                subLabel={hiddenIds().join(", ") || "none"}
            />
            <FormDivider />
            <FormRow
                label="Stores found holding a hidden id"
                subLabel={diag.sources.join("\n") || "none found at load"}
            />
            <FormDivider />
            {patched.length === 0 && (
                <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    Nothing was patched on this client.
                </FormText>
            )}
            {patched.map((label, i) => {
                const calls = diag.calls[label] ?? 0;
                const removed = diag.removed[label] ?? 0;
                const sample = diag.sample[label];

                let status: string;
                if (calls === 0) status = "never called — not what renders your list";
                else if (removed === 0)
                    status = `called ${calls}x but removed nothing — ids don't match`;
                else status = `called ${calls}x, removed ${removed} — filter is working`;

                return (
                    <React.Fragment key={label}>
                        <FormRow
                            label={label}
                            subLabel={sample ? `${status}\nsaw: ${sample}` : status}
                        />
                        {i < patched.length - 1 && <FormDivider />}
                    </React.Fragment>
                );
            })}
        </>
    );
}

// Whether we caught the gateway payload and removed the channel before any store
// or the local database saw it.
function Gateway() {
    return (
        <>
            <FormRow
                label="CONNECTION_OPEN seen"
                subLabel={
                    gatewayDiag.connectionOpen === 0
                        ? "not since load — restart Discord with the plugin enabled"
                        : `${gatewayDiag.connectionOpen}x`
                }
            />
            <FormDivider />
            <FormRow
                label="Private channel list in payload"
                subLabel={
                    gatewayDiag.listKey
                        ? `${gatewayDiag.listKey}, ${gatewayDiag.listLength} entries, ${gatewayDiag.removed} removed`
                        : "neither privateChannels nor private_channels found"
                }
            />
            <FormDivider />
            <FormRow
                label="CONNECTION_OPEN keys"
                subLabel={gatewayDiag.keys.join(", ") || "none captured yet"}
            />
            <FormDivider />
            <FormRow
                label="CHANNEL_CREATE for a hidden id"
                subLabel={`${gatewayDiag.channelCreates}x (counted, not blocked)`}
            />
        </>
    );
}

// The app_database subtree. Discord mobile queries a local database for lists,
// which would explain why filtering Flux store getters changes nothing on screen.
function AppDatabase() {
    const paths = React.useMemo(() => pathsUnder("app_database"), []);

    if (paths.length === 0) {
        return (
            <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                Nothing imported from app_database.
            </FormText>
        );
    }

    return (
        <>
            {paths.map((m, i) => (
                <React.Fragment key={m.id}>
                    <FormRow label={m.path} subLabel={`module ${m.id}`} />
                    {i < paths.length - 1 && <FormDivider />}
                </React.Fragment>
            ))}
        </>
    );
}

// Searches the source paths Kettu records for every module Discord imports.
// These are Discord's own file names, so a match tells us where the DM list
// actually lives instead of us guessing at prop names.
function Paths() {
    const report = React.useMemo(
        () => ({ stats: filePathStats(), matches: matchingPaths() }),
        []
    );

    return (
        <>
            <FormRow
                label="Modules scanned"
                subLabel={`${report.stats.total} total, ${report.stats.withPath} with a source path`}
            />
            <FormDivider />
            {report.matches.length === 0 ? (
                <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    No DM-related paths recorded yet. Open the DMs tab, then reopen this
                    page — paths only appear once Discord imports the module.
                </FormText>
            ) : (
                report.matches.map((m, i) => (
                    <React.Fragment key={m.id}>
                        <FormRow label={m.path} subLabel={`module ${m.id}`} />
                        {i < report.matches.length - 1 && <FormDivider />}
                    </React.Fragment>
                ))
            )}
        </>
    );
}

export default function Settings() {
    useProxy(storage);

    const groups = React.useMemo(getGroupDMs, []);

    return (
        <RN.ScrollView style={{ flex: 1 }}>
            <FormSection title="Group DMs">
                {groups.length === 0 ? (
                    <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        No group DMs found.
                    </FormText>
                ) : (
                    groups.map((channel, i) => (
                        <React.Fragment key={channel.id}>
                            <FormSwitchRow
                                label={channelLabel(channel)}
                                subLabel={`ID: ${channel.id}`}
                                value={isHidden(channel.id)}
                                onValueChange={(v: boolean) => setHidden(channel.id, v)}
                            />
                            {i < groups.length - 1 && <FormDivider />}
                        </React.Fragment>
                    ))
                )}
            </FormSection>

            <FormSection title="Diagnostics">
                <Diagnostics />
            </FormSection>

            <FormSection title="Gateway">
                <Gateway />
            </FormSection>

            <FormSection title="app_database modules">
                <AppDatabase />
            </FormSection>

            <FormSection title="Module paths">
                <Paths />
            </FormSection>
        </RN.ScrollView>
    );
}
