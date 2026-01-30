CREATE TABLE User_System (
    user_id NUMBER PRIMARY KEY,
    username VARCHAR2(255) NOT NULL,
    password VARCHAR2(255) NOT NULL
);

CREATE TABLE CategoryTransaction (
    id NUMBER PRIMARY KEY,
    user_id NUMBER,
    name VARCHAR2(255) NOT NULL,
    CONSTRAINT fk_category_user FOREIGN KEY (user_id) REFERENCES User_System(user_id)
);

CREATE TABLE Wallet (
    wallet_id NUMBER PRIMARY KEY,
    user_id NUMBER,
    name VARCHAR2(255),
    actual_cash NUMBER(15, 2),
    type VARCHAR2(50),
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES User_System(user_id)
);

CREATE TABLE Transaction (
    transaction_id NUMBER PRIMARY KEY,
    wallet_id NUMBER,
    category_id NUMBER,
    transaction_date DATE DEFAULT SYSDATE,
    transaction_type VARCHAR2(50),
    is_recurring NUMBER(1),
    value NUMBER(15, 2),
    installment_id NUMBER,
    installment_total NUMBER,
    installment_number NUMBER,
    CONSTRAINT fk_transaction_wallet FOREIGN KEY (wallet_id) REFERENCES Wallet(wallet_id),
    CONSTRAINT fk_transaction_category FOREIGN KEY (category_id) REFERENCES CategoryTransaction(id)
);

CREATE TABLE EconomicIndicator (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(255),
    current_rate NUMBER(10, 4),
    last_update DATE
);

CREATE TABLE Type_Investment (
    investment_category NUMBER PRIMARY KEY,
    investment_name VARCHAR2(255)
);

CREATE TABLE Investment (
    investment_id NUMBER PRIMARY KEY,
    wallet_id NUMBER,
    investment_category NUMBER,
    indicator_id NUMBER,
    name VARCHAR2(255),
    start_date DATE,
    maturity_date DATE,
    invested_amount NUMBER(15, 2),
    current_amount NUMBER(15, 2),
    percentage_of_indicator NUMBER(10, 4),
    fix_rate NUMBER(10, 4),
    CONSTRAINT fk_investment_wallet FOREIGN KEY (wallet_id) REFERENCES Wallet(wallet_id),
    CONSTRAINT fk_investment_type FOREIGN KEY (investment_category) REFERENCES Type_Investment(investment_category),
    CONSTRAINT fk_investment_indicator FOREIGN KEY (indicator_id) REFERENCES EconomicIndicator(id)
);

CREATE TABLE Wishlist (
    id_wishlist NUMBER PRIMARY KEY,
    id_user NUMBER,
    name VARCHAR2(255),
    CONSTRAINT fk_wishlist_user FOREIGN KEY (id_user) REFERENCES User_System(user_id)
);

CREATE TABLE ProductWishlist (
    id_product NUMBER PRIMARY KEY,
    id_wishlist NUMBER,
    name_product VARCHAR2(255),
    price NUMBER(15, 2),
    CONSTRAINT fk_product_wishlist FOREIGN KEY (id_wishlist) REFERENCES Wishlist(id_wishlist)
);