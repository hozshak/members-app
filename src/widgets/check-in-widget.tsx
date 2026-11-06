// Stand-in for the browser and for the type check: the real widgets are check-in-widget.ios.tsx and check-in-widget.android.tsx
// (Metro picks them by platform).
import type { WidgetTimelineEntry } from 'expo-widgets';
import type { CheckInWidgetProps } from './props';

const widget = {
  updateSnapshot(_props: CheckInWidgetProps): void {},
  updateTimeline(_entries: WidgetTimelineEntry<CheckInWidgetProps>[]): void {},
};
export default widget;
