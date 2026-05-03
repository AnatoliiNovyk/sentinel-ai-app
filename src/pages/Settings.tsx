import { SettingsProfile } from './settings/SettingsProfile';
import { SettingsSecurity } from './settings/SettingsSecurity';
import { SettingsSubscription } from './settings/SettingsSubscription';

export default function Settings() {
  return (
    <div className="p-8 max-w-5xl space-y-8">
      <SettingsSubscription />
      <SettingsProfile />
      <SettingsSecurity />
    </div>
  );
}
