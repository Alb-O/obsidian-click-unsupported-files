export interface DoubleClickNonNativeSettings {
	doubleClickDelay: number;
	enableForAllFiles: boolean;
	enableDummyView: boolean;
}

export const DEFAULT_SETTINGS: DoubleClickNonNativeSettings = {
	doubleClickDelay: 300,
	enableForAllFiles: true,
	enableDummyView: true
};

export const VIEW_TYPE_DUMMY = "dummy-file-view";
