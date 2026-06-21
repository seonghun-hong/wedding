export type BankAccount = {
  name: string;
  bank: string;
  account: string;
  holder: string;
};

export const invitation = {
  groom: {
    name: "성훈",
    fullName: "홍성훈",
    phone: "010-4196-5721",
    father: "홍경선",
    mother: "김미정",
    accounts: [
      { name: "홍성훈", bank: "토스뱅크", account: "1000-5318-6567", holder: "홍성훈" },
      { name: "홍경선", bank: "NH농협", account: "000-0000-0000-00", holder: "홍경선" },
      { name: "김미정", bank: "NH농협", account: "000-0000-0000-00", holder: "김미정" },
    ] as BankAccount[],
  },

  bride: {
    name: "지연",
    fullName: "안지연",
    phone: "010-9822-2382",
    father: "안복균",
    mother: "이복순",
    accounts: [
      { name: "안지연", bank: "토스뱅크", account: "1000-2724-7445", holder: "안지연" },
      { name: "이복순", bank: "신한은행", account: "000-000-000000", holder: "이복순" },
    ] as BankAccount[],
  },

  wedding: {
    date: "2026-10-03T11:00:00+09:00",
    year: 2026,
    month: 10,
    day: 3,
    displayDate: "2026년 10월 03일 토요일 오전 11시",
    hallName: "하우스 오브 더 라움",
    hallDetail: "벨루스홀",
    address: "서울특별시 광진구 능동로 81",
  },

  intro: [
    "저희 두 사람이 하나가 되어",
    "첫 발걸음을 내딛는 시작,",
    "",
    "시간이 흘러도 이날을 기억하며",
    "설레고도 기뻤던 날을 떠올릴 것입니다.",
    "",
    "밝은 미소로 함께해 주신다면",
    "평생의 기억으로 소중히 간직하겠습니다.",
  ],

  gallery: [
    "/images/gallery-01.jpg",
    "/images/gallery-02.jpg",
    "/images/gallery-03.jpg",
    "/images/gallery-04.jpg",
    "/images/gallery-05.jpg",
    "/images/gallery-06.jpg",
    "/images/gallery-07.jpg",
    "/images/gallery-08.jpg",
    "/images/gallery-09.jpg",
    "/images/gallery-10.jpg",
    "/images/gallery-11.jpg",
    "/images/gallery-12.jpg",
  ],

  links: {
    kakaoMap: "https://map.kakao.com/?q=%EB%B9%8C%EB%9D%BC%EB%93%9C%EB%A7%88%EB%A5%B4%20%EC%9D%B4%EC%B2%9C",
    naverMap: "https://map.naver.com/p/search/%EB%B9%8C%EB%9D%BC%EB%93%9C%EB%A7%88%EB%A5%B4%20%EC%9D%B4%EC%B2%9C",
    googleMap: "https://www.google.com/maps/search/?api=1&query=%EB%B9%8C%EB%9D%BC%EB%93%9C%EB%A7%88%EB%A5%B4%20%EC%9D%B4%EC%B2%9C",
  },

  transport: {
    subway: ["건대입구역 5번 출구", "도보 약 3분"],
    bus: ["이천역에서 탑승", "3번, 12번, 12-1번 탑승", "이천터미널에서 탑승", "22-3번, 22-9번 탑승"],
    parking: ["웨딩홀 지하 주차장 이용 가능", "2시간 무료 주차 제공"],
  },
};
