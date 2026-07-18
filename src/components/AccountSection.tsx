import { useState } from "react";
import { Copy } from "lucide-react";
import { BankAccount, invitation } from "../data/invitation";
import { copyText } from "../lib/clipboard";
import { Toast } from "./Toast";

export function AccountSection() {
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1500);
  };

  const copy = async (account: BankAccount) => {
    await copyText(account.account);
    showToast("계좌번호가 복사되었습니다.");
  };

  return (
    <section className="section account-section">
      <div className="account-heading">
        <p className="account-script">Account</p>
        <h2 className="account-title">마음 전하실 곳</h2>
      </div>

      <AccountGroup
        title="신랑측 계좌번호"
        accounts={invitation.groom.accounts}
        onCopy={copy}
      />

      <AccountGroup
        title="신부측 계좌번호"
        accounts={invitation.bride.accounts}
        onCopy={copy}
      />

      <Toast message={toast} />
    </section>
  );
}

function AccountGroup({
  title,
  accounts,
  onCopy,
}: {
  title: string;
  accounts: BankAccount[];
  onCopy: (account: BankAccount) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="account-group">
      <button
        className="account-header"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span className="chevron">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="account-cards">
          {accounts.map((account) => (
            <div
              className="account-card"
              key={`${title}-${account.name}-${account.account}`}
            >
              <div>
                <b>{account.name}</b>
                <p>
                  {account.bank} 예금주 : {account.holder}
                </p>
                <p className="account-number">{account.account}</p>
              </div>

              <button
                className="copy-btn"
                type="button"
                onClick={() => onCopy(account)}
                aria-label="계좌 복사"
              >
                <Copy size={22} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
