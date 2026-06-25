import { invitation } from "../data/invitation";

export function IntroSection() {
  const call = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <section className="section intro-section">
      <div className="intro-icon">💍</div>
      <p className="intro-eng">WEDDING INVITATION</p>

      <h1 className="couple-name">
        {invitation.groom.name} · {invitation.bride.name}
      </h1>

      <p className="date-line">{invitation.wedding.displayDate}</p>
      <p className="place-line">
        {invitation.wedding.hallName} {invitation.wedding.hallDetail}
      </p>

      <div className="intro-text">
        {invitation.intro.map((line, index) =>
          line ? <p key={index}>{line}</p> : <div className="text-space" key={index} />
        )}
      </div>

      <div className="parents-line">
        <p>
          {invitation.groom.father} · {invitation.groom.mother} 의 아들 <b>{invitation.groom.name}</b>
        </p>
        <p>
          {invitation.bride.father} · {invitation.bride.mother} 의 딸 <b>{invitation.bride.name}</b>
        </p>
      </div>

    </section>
  );
}
