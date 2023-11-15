import { ReactElement, useEffect, useState } from "react"
// import { bitable } from "@lark-base-open/js-sdk"
// import './style.css'

export default function LoadApp(props: { neverShowBanner?: boolean, children: ReactElement }): ReactElement {

  return <div>
    {props.children}
  </div>

}




