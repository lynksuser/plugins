import { findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

import { diag, isHidden, originals, setHidden } from "./hidden";
import {
    channelStoreNames,
    listFunctions,
    privateChannelModules,
} from "./debug";

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
            {patched.map((label, i) => {
                const count = diag.calls[label] ?? 0;
                return (
                    <React.Fragment key={label}>
                        <FormRow
                            label={label}
                            subLabel={
                                count > 0
                                    ? `called ${count}x — this one is live`
                                    : "never called — not what renders your list"
                            }
                        />
                        {i < patched.length - 1 && <FormDivider />}
                    </React.Fragment>
                );
            })}
        </>
    );
}

// Reports what this client actually exposes, so we can stop guessing at names.
function Discovery() {
    const report = React.useMemo(() => {
        const stores = channelStoreNames();
        return {
            stores: stores.map((name) => ({
                name,
                fns: listFunctions(findByStoreName(name)),
            })),
            modules: privateChannelModules(),
        };
    }, []);

    return (
        <>
            <FormRow
                label="Modules exposing a private-channel list"
                subLabel={report.modules.join(", ") || "none found"}
            />
            <FormDivider />
            {report.stores.length === 0 ? (
                <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    No channel-ish stores found via the dispatcher.
                </FormText>
            ) : (
                report.stores.map((s, i) => (
                    <React.Fragment key={s.name}>
                        <FormRow
                            label={s.name}
                            subLabel={s.fns.join(", ") || "no list-shaped functions"}
                        />
                        {i < report.stores.length - 1 && <FormDivider />}
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

            <FormSection title="Discovery">
                <Discovery />
            </FormSection>
        </RN.ScrollView>
    );
}
