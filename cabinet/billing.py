"""Каталог и предварительное оформление до подключения кассы Platega."""

import re
from html import escape
from pathlib import Path
from string import Template

MAX_PAYMENT_RUB = 10_000
# Срок в днях → полная стоимость, руб.
PLANS = {30: 299, 90: 819, 180: 1490}
PAGE = Template(Path(__file__).with_name('tariffs.html').read_text(encoding='utf-8'))
EMAIL = re.compile(r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+")


def rub(amount: int) -> str:
    return f'{amount:,}'.replace(',', ' ') + ' ₽'


def plan_price(days: int) -> int:
    price = PLANS.get(days, 0)
    if not 0 < price <= MAX_PAYMENT_RUB:
        raise ValueError('Выберите доступный срок подписки.')
    return price


def payment_request(days: int, email: str) -> dict:
    price = plan_price(days)
    email = email.strip()
    if len(email) > 254 or len(email.partition('@')[0]) > 64 or not EMAIL.fullmatch(email):
        raise ValueError('Введите свой адрес электронной почты, например name@example.ru.')
    return {
        'paymentMethod': 2,
        'paymentDetails': {'amount': price, 'currency': 'RUB'},
        'description': f'Личный VPN-доступ Aegis Gate на {days} дней',
        'metadata': {'user_email': email},
    }


def tariffs_page(days: int | None = None, *, submitted: bool = False, error: str = '') -> str:
    cards = []
    for term in PLANS:
        price = plan_price(term)
        cards.append(f'''
          <article class="panel tariff-card">
            <h2 class="display d-sm">{term} дней</h2>
            <p class="tariff-price">{rub(price)}</p>
            <a class="btn" href="/tariffs?plan={term}#order" aria-label="Купить доступ на {term} дней за {price} рублей"><span>Купить</span></a>
          </article>''')
    order = f'<p role="alert">{escape(error)}</p>' if error else ''
    if days is not None:
        price = plan_price(days)
        heading = f'<h2 class="display d-sm">VPN на {days} дней · {rub(price)}</h2>'
        if submitted:
            body = '<p role="status">Оплата временно недоступна. Деньги не списаны. Сейчас можно воспользоваться бесплатным тестом.</p><a href="/connect">Подключиться к тесту</a>'
        else:
            warning = order
            body = f'''
            <p>Оплата временно недоступна. Форму можно проверить без списания денег.</p>
            <form method="post" action="/tariffs#order" class="tariff-form">
              <input type="hidden" name="plan" value="{days}">
              <label for="buyer-email">Электронная почта покупателя</label>
              <input id="buyer-email" type="email" name="email" autocomplete="email" maxlength="254" required>
              {warning}
              <small>При подключённой кассе этот адрес передаётся Platega при оформлении платежа.
                <a href="/legal/privacy.html">Политика конфиденциальности</a></small>
              <button type="submit" class="btn"><span>Оплатить {rub(price)}</span></button>
            </form>'''
        order = f'<section id="order" class="panel tariff-order" aria-label="Оформление заказа">{heading}{body}</section>'
    return PAGE.substitute(cards=''.join(cards), order=order)
