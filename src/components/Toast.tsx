import { createPortal } from "react-dom";

export function Toast({ message }: { message: string }) {
    if (!message) {
        return null;
    }

    return createPortal(
        <div className="toast">{message}</div>,
        document.body
    );
}