import { findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

import { isHidden, setHidden } from "./hidden";

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

// Deliberately reads ChannelStore, not the sort store we patch in index.ts —
// otherwise hidden groups would vanish from this list and be impossible to unhide.
function getGroupDMs(): any[] {
    const mutable = ChannelStore?.getMutablePrivateChannels?.();
    const list = mutable
        ? Object.values(mutable)
        : ChannelStore?.getSortedPrivateChannels?.() ?? [];

    return (list as any[])
        .filter((c) => c?.type === GROUP_DM)
        .sort((a, b) => channelLabel(a).localeCompare(channelLabel(b)));
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
        </RN.ScrollView>
    );
}
