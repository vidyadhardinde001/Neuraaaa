import {MouseEventHandler, ReactNode} from "react";

export enum ButtonSize {
    Small,
}


interface Props {
    children: ReactNode;
    onClick: MouseEventHandler<HTMLButtonElement>;
    size: ButtonSize;
    className?: string;
}

export default function Button({ children, size, className, onClick }: Props) {
    let styles = `rounded ${className + " " || ""} bg-accent text-white hover:opacity-90`;

    switch (size) {
        case ButtonSize.Small:
            styles += "h-6 w-24";
            break;
        default: break;
    }

    return (
        <button className={styles} onClick={onClick}>{children}</button>
   )
}