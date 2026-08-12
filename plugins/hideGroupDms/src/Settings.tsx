import { ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms } from "@vendetta/ui/components";

import { hideNow } from "./localdelete";

const { FormSection, FormSwitchRow, FormText } = Forms;

export default function Settings() {
    useProxy(storage);

    return (
        <RN.ScrollView style={{ flex: 1 }}>
            <FormSection title="Configuration">
                {/* Replaced FormInputRow with a standard React Native View and TextInput */}
                <RN.View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    <FormText style={{ marginBottom: 8 }}>
                        Group DM ID
                    </FormText>
                    <RN.TextInput
                        style={{
                            color: "white",
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: 8,
                            padding: 12,
                            fontSize: 16,
                        }}
                        placeholder="Paste the Channel ID here..."
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        value={storage.targetGroupId || ""}
                        onChangeText={(text: string) => {
                            storage.targetGroupId = text;
                            if (storage.hideMyGroup) hideNow();
                        }}
                    />
                </RN.View>

                <FormSwitchRow
                    label="Hide Group DM"
                    subLabel={
                        storage.hideMyGroup
                            ? "Hidden on this device"
                            : "Visible"
                    }
                    value={!!storage.hideMyGroup}
                    onValueChange={(hidden: boolean) => {
                        storage.hideMyGroup = hidden;
                        if (hidden) hideNow();
                    }}
                />
            </FormSection>

            <FormSection title="How it works">
                <FormText
                    style={{ paddingHorizontal: 16, paddingVertical: 12, opacity: 0.7 }}
                >
                    Your Channel ID is stored locally on this device and won't be pushed to GitHub.
                    Hiding tells this device the channel was deleted. Un-hiding takes effect when Discord next syncs the channel, which is usually on restart.
                </FormText>
            </FormSection>
        </RN.ScrollView>
    );
}
