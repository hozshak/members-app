// Stand-in for the browser and for the type check: the real widgets are routine-widget.ios.tsx and routine-widget.android.tsx
// (Metro picks them by platform).
import type { WidgetTimelineEntry } from 'expo-widgets';
import type { RoutineWidgetProps } from './props';

const widget = {
  updateSnapshot(_props: RoutineWidgetProps): void {},
  updateTimeline(_entries: WidgetTimelineEntry<RoutineWidgetProps>[]): void {},
};
export default widget;
