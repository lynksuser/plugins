import { findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

import { diag, hiddenIds, isHidden, originals, rowDiag, setHidden } from "./hidden";
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

    if (!patched.length) {
        return (
            <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                Nothing was patched. None of the candidate modules exist on this client,
                so hiding cannot work yet.
            </FormText>
        );
    }

    return (
        <>
            <FormRow
                label="Hidden ids in storage"
                subLabel={hiddenIds().join(", ") || "none"}
            />
            <FormDivider />
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

// State of the home drawer DM row patch — the current best candidate.
function DMRow() {
    return (
        <>
            <FormRow label="Row patch" subLabel={rowDiag.status} />
            <FormDivider />
            <FormRow
                label="Renders / hidden / no id found"
                subLabel={`${rowDiag.calls} rendered, ${rowDiag.matched} hidden, ${rowDiag.noId} without an id`}
            />
            <FormDivider />
            <FormRow
                label="Row prop keys"
                subLabel={rowDiag.propKeys.join(", ") || "none captured yet"}
            />
        </>
    );
}

// The whole home_drawer subtree, so we can see the list component alongside the
// row if the row patch turns out to be the wrong level.
function HomeDrawer() {
    const paths = React.useMemo(() => pathsUnder("home_drawer"), []);

    if (paths.length === 0) {
        return (
            <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                Nothing imported from home_drawer yet. Open the DMs tab first.
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

            <FormSection title="DM row patch">
                <DMRow />
            </FormSection>

            <FormSection title="home_drawer modules">
                <HomeDrawer />
            </FormSection>

            <FormSection title="Module paths">
                <Paths />
            </FormSection>
        </RN.ScrollView>
    );
}
