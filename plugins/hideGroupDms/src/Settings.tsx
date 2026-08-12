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

export default function Settings() {
    useProxy(storage);

    const [searchQuery, setSearchQuery] = React.useState("");

    // --- SPEED OPTIMIZATION: Move writes out of the render cycle ---
    // Instead of saving labels while typing the search query, do it once when settings open
    React.useEffect(() => {
        const mutable = ChannelStore?.getMutablePrivateChannels?.();
        const live = mutable
            ? Object.values(mutable)
            : ChannelStore?.getSortedPrivateChannels?.() ?? [];

        const visible = (live as any[])
            .filter((c) => c?.type === GROUP_DM);
        
        for (const c of visible) {
            remember(c.id, channelLabel(c));
        }
    }, []);

    // --- SPEED OPTIMIZATION: Memoization ---
    // Only fetch from the Discord store once. Prevents massive lag when typing.
    const allGroups = React.useMemo(() => {
        const mutable = ChannelStore?.getMutablePrivateChannels?.();
        const live = mutable
            ? Object.values(mutable)
            : ChannelStore?.getSortedPrivateChannels?.() ?? [];

        const visible = (live as any[])
            .filter((c) => c?.type === GROUP_DM)
            .map((c) => ({ id: c.id, label: channelLabel(c) }));

        const seen = new Set(visible.map((g) => g.id));
        const stored = knownGroups().filter((g) => !seen.has(g.id));

        return [...visible, ...stored].sort((a, b) => a.label.localeCompare(b.label));
    }, []); // Empty dependency array = only runs on component mount

    // Fast local filter based on the memoized list
    const filteredGroups = React.useMemo(() => {
        return allGroups.filter(g => 
            g.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
            g.id.includes(searchQuery)
        );
    }, [allGroups, searchQuery]);

    const hasMore = filteredGroups.length > 50;
    const visibleGroups = filteredGroups.slice(0, 50);

    return (
        <RN.ScrollView style={{ flex: 1 }}>
            <RN.View style={{ padding: 16, paddingBottom: 0 }}>
                <RN.TextInput
                    style={{
                        backgroundColor: "rgba(128, 128, 128, 0.1)",
                        color: "white",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 16,
                        borderWidth: 1,
                        borderColor: "rgba(128, 128, 128, 0.3)"
                    }}
                    placeholder="Search group DMs by name or ID..."
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </RN.View>

            <FormSection title={searchQuery ? "Search Results" : "Group DMs"}>
                {visibleGroups.length === 0 ? (
                    <FormText style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                        {allGroups.length === 0 
                            ? "No group DMs found." 
                            : "No group DMs match your search."}
                    </FormText>
                ) : (
                    <>
                        {visibleGroups.map((group, i) => (
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
                                        // Targeted hide is fast and won't drop frames
                                        if (hidden) hideNow(group.id);
                                    }}
                                />
                                {i < visibleGroups.length - 1 && <FormDivider />}
                            </React.Fragment>
                        ))}
                        
                        {hasMore && (
                            <>
                                <FormDivider />
                                <FormText style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>
                                    + {filteredGroups.length - 50} more. Use the search bar to find them.
                                </FormText>
                            </>
                        )}
                    </>
                )}
            </FormSection>

            <FormSection title="How it works">
                <FormText
                    style={{ paddingHorizontal: 16, paddingVertical: 12, opacity: 0.7 }}
                >
                    Hiding a group DM tells the local client (not the server) that the channel was deleted, hiding it from view while allowing you to stay in the group DM with no change visible to other group members. 
                </FormText>
            </FormSection>
        </RN.ScrollView>
    );
}
