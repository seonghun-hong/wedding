import { useState } from "react";
import { Copy } from "lucide-react";
import { BankAccount, invitation } from "../data/invitation";
import { copyText } from "../lib/clipboard";

export function AccountSection() {
  const [toast, setToast] = useState("");

  const copy = async (account: BankAccount) => {
    await copyText(`${account.bank} ${account.account} 예금주 ${account.holder}`);
    setToast("계좌번호가 복사되었습니다.");
    window.setTimeout(() => setToast(""), 1500);
  };

  return (
    <section className="section account-section">
      <h2 className="section-title">ACCOUNT</h2>

      <AccountGroup title="신랑측 계좌번호" accounts={invitation.groom.accounts} onCopy={copy} />
      <AccountGroup title="신부측 계좌번호" accounts={invitation.bride.accounts} onCopy={copy} />

      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}

function AccountGroup({ title, accounts, onCopy }: {
  title: string;
  accounts: BankAccount[];
  onCopy: (account: BankAccount) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="account-group">
      <button className="account-header" type="button" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="chevron">{open ? "⌃" : "⌄"}</span>
      </button>

      {open && (
        <div className="account-cards">
          {accounts.map((account) => (
            <div className="account-card" key={`${title}-${account.name}-${account.account}`}>
              <div>
                <b>{account.name}</b>
                <p>{account.bank} 예금주 : {account.holder}</p>
                <p className="account-number">{account.account}</p>
              </div>
              <button className="copy-btn" type="button" onClick={() => onCopy(account)} aria-label="계좌 복사">
                <Copy size={22} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
