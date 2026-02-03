import * as React from "react";

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { className = "", ...rest } = props;
  return <label className={`text-sm font-medium ${className}`} {...rest} />;
}
