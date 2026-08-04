import { findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

import { isHidden, knownGroups, remember, setHidden } from "./hidden";
import { hideNow } from "./localdelete";

const { FormSection, FormSwitchRow, FormText, FormDivider } = Forms;

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

/**
 * Every group DM that can be toggled: the ones Discord currently knows about,
 * merged with everything we've recorded. Hidden channels are absent from
 * ChannelStore by design, so the stored half is what keeps them listed.
 */
function toggleableGroups(): Array<{ id: string; label: string }> {
    const mutable = ChannelStore?.getMutablePrivateChannels?.();
    const live = mutable
        ? Object.values(mutable)
        : ChannelStore?.getSortedPrivateChannels?.() ?? [];

    const visible = (live as any[])
        .filter((c) => c?.type === GROUP_DM)
        .map((c) => ({ id: c.id, label: channelLabel(c) }));

    // Keep labels current while we can still read them.
    for (const group of visible) remember(group.id, group.label);

    const seen = new Set(visible.map((g) => g.id));
    const stored = knownGroups().filter((g) => !seen.has(g.id));

    return [...visible, ...stored].sort((a, b) => a.label.localeCompare(b.label));
}

export default function Settings() {
    useProxy(storage);

    // Recomputed per render rather than memoised: toggling changes this list,
    // because hiding removes the channel from ChannelStore.
    const groups = toggleableGroups();

    return (
        <RN.ScrollView style={{ flex: 1 }}>
            <FormSection title="Group DMs">
                {groups.length === 0 ? (
                    <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        No group DMs found.
                    </FormText>
                ) : (
                    groups.map((group, i) => (
                        <React.Fragment key={group.id}>
                            <FormSwitchRow
                                label={group.label}
                                subLabel={
                                    isHidden(group.id)
                                        ? "Hidden on this device"
                                        : "Visible"
                                }
                                value={isHidden(group.id)}
                                onValueChange={(hidden: boolean) => {
                                    setHidden(group.id, group.label, hidden);
                                    // Called here rather than inside setHidden so
                                    // hidden.ts stays free of a circular import.
                                    if (hidden) hideNow();
                                }}
                            />
                            {i < groups.length - 1 && <FormDivider />}
                        </React.Fragment>
                    ))
                )}
            </FormSection>

            <FormSection title="How it works">
                <FormText
                    style={{ paddingHorizontal: 16, paddingVertical: 12, opacity: 0.7 }}
                >
                    Hiding tells this device the channel was deleted. Nothing is sent to
                    Discord, so you stay in the group and nobody else sees a change.
                    Un-hiding takes effect once Discord next syncs the channel, which is
                    usually on restart.
                </FormText>
            </FormSection>
        </RN.ScrollView>
    );
}
