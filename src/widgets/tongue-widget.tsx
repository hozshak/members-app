// Stand-in for the browser and for the type check: the real widgets are tongue-widget.ios.tsx and tongue-widget.android.tsx (Metro picks them by platform).
import type { TongueWidgetProps } from './props';

const widget = {
  updateSnapshot(_props: TongueWidgetProps): void {},
};
export default widget;
